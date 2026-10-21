const { it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const Ticket = require('../models/CustomerRepairTicket');
const media = require('../lib/repairMedia');
const { resetRateLimitForTests } = require('../middleware/rateLimit');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hdt-repair-media-test-'));
const oldRoot = process.env.REPAIR_MEDIA_DIR;
const oldSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'repair-media-test-secret-never-used-outside-this-process';
after(() => {
  if (oldRoot === undefined) delete process.env.REPAIR_MEDIA_DIR;
  else process.env.REPAIR_MEDIA_DIR = oldRoot;
  if (oldSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = oldSecret;
  resetRateLimitForTests();
  fs.rmSync(scratch, { recursive: true, force: true });
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3uoAAAAASUVORK5CYII=', 'base64');
function box(type, contents = Buffer.alloc(0)) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(contents.length + 8);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, contents]);
}
// Container fixtures exercise the real file-type import; they are not playable video clips.
const mp4 = Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isommp41')), box('mdat'), box('moov')]);
const mov = Buffer.concat([box('ftyp', Buffer.from('qt  \0\0\0\0qt  ')), box('mdat'), box('moov')]);
const webm = Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878102428581021853806780', 'hex');
const image = (name = 'camera.png', bytes = png, mime = 'image/png') => ({ name, bytes, mime });
const video = (name = 'camera.mp4', bytes = mp4, mime = 'video/mp4') => ({ name, bytes, mime });
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const limits = { ...media.LIMITS, imageBytes: 1024, videoBytes: 2048, totalBytes: 4096 };
const ticketId = '507f1f77bcf86cd799439011';
const otherTicketId = '507f1f77bcf86cd799439012';
const fields = { firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '0912345678', model_name: 'Camera', symptom: 'Shutter stuck', condition_at_intake: 'Customer scratch report' };

function loadModule(relative, stubs) {
  const filename = path.resolve(__dirname, '..', relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  const factory = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${fs.readFileSync(filename, 'utf8')}\n})`, { filename });
  factory((name) => Object.hasOwn(stubs, name) ? stubs[name] : localRequire(name), module, module.exports, filename, path.dirname(filename));
  return module.exports;
}

function form(files = [image()], data = { media_acknowledged: 'true' }) {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.append(key, String(value));
  for (const file of files) body.append(file.field || 'media', new Blob([file.bytes], { type: file.mime }), file.name);
  return body;
}

async function waitFor(check, message) {
  for (let n = 0; n < 100; n += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(check(), message);
}

async function harness(t, options = {}) {
  resetRateLimitForTests();
  const root = fs.mkdtempSync(path.join(scratch, 'batch-'));
  process.env.REPAIR_MEDIA_DIR = root;
  const state = { contexts: [], uploadCalls: 0, saves: 0, saved: [], tickets: new Map(), emailCalls: 0, queries: 0 };
  const customer = { _id: ticketId, firstName: 'Test', lastName: 'Customer', email: fields.email, phone: fields.phone };
  function MemoryTicket(data) {
    const doc = new Ticket(data);
    doc.save = async () => {
      state.saves += 1;
      await doc.validate();
      if (state.saveError) throw state.saveError;
      doc.isNew = false;
      state.saved.push(doc);
      state.tickets.set(String(doc._id), doc);
      return doc;
    };
    return doc;
  }
  MemoryTicket.findById = (id) => {
    state.queries += 1;
    return { select: async () => state.tickets.get(String(id)) || null };
  };
  const service = loadModule('services/customerRepairService.js', {
    '../models/CustomerRepairTicket': MemoryTicket,
    '../models/Customer': { findById: () => ({ select: async () => customer }) },
    '../utils/repairHelpers': { ...require('../utils/repairHelpers'), generateRepairTicketNumber: async () => 'SRV-TEST-0001' },
    './emailService': {
      sendRepairIntakeEmail: async () => { state.emailCalls += 1; if (state.emailError) throw state.emailError; return { sent: false, skipped: true }; },
      sendRepairQuoteEmail: async () => assert.fail('unexpected quote email'),
      sendRepairReadyEmail: async () => assert.fail('unexpected ready email'),
    },
  });
  const upload = media.createRepairMediaUpload({ root, limits: { ...limits, ...options.limits }, maxConcurrent: options.maxConcurrent ?? 2, storageLimitBytes: options.storageLimitBytes ?? 1024 * 1024 });
  const repairMediaUpload = (req, res, next) => {
    state.uploadCalls += 1;
    const result = upload(req, res, next);
    if (req.repairMedia) state.contexts.push(req.repairMedia);
    return result;
  };
  const webIntake = require('../utils/webIntake');
  const publicRouter = loadModule('routes/publicIntake.js', {
    '../lib/repairMedia': { ...media, repairMediaUpload },
    '../services/customerRepairService': service,
    '../utils/webIntake': { ...webIntake, findOrCreateWebCustomer: async () => { if (state.customerError) throw state.customerError; return customer; } },
    '../models/Film': {},
    '../services/emailService': { sendConfirmationEmail: async () => assert.fail('unexpected film email') },
    '../services/shopCatalog': { listPublicShop: async () => [] },
    '../services/shopOrders': { createShopOrder: async () => assert.fail('unexpected shop order') },
  });
  const user = { _id: ticketId, role: 'staff', status: 'active', sessionVersion: 0 };
  const { verifyToken } = loadModule('middleware/verifyToken.js', {
    '../models/User': { findById: () => ({ select: async () => user }) },
  });
  const repairsRouter = loadModule('routes/repairs.js', {
    '../models/CustomerRepairTicket': MemoryTicket,
    './auth': { verifyToken },
    '../services/customerRepairService': service,
    '../services/emailService': { formatEmailNote: () => '' },
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.defineProperty(req, 'ip', { value: '203.0.113.50' }); next(); });
  app.post('/upload', repairMediaUpload, async (req, res) => {
    const files = req.repairMedia?.files || [];
    if (req.repairMedia) req.repairMedia.committed = true;
    await req.repairMedia?.dispose();
    res.json({ media: media.publicMedia(files) });
  });
  app.use('/public', publicRouter);
  app.use('/repairs', repairsRouter);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (url = '/upload', body = form(), headers = {}) => fetch(base + url, { method: 'POST', body, headers, signal: AbortSignal.timeout(5000) });
  const auth = (role = 'staff') => {
    user.role = role;
    return { Authorization: `Bearer ${jwt.sign({ userId: ticketId, sv: 0 }, process.env.JWT_SECRET, { expiresIn: '5m' })}` };
  };
  const empty = () => waitFor(() => fs.readdirSync(root).length === 0, 'rejected upload left a private batch');
  return { root, state, service, base, send, auth, user, empty };
}

async function uploadRecord(h, file = image()) {
  const response = await h.send('/upload', form([file]));
  assert.equal(response.status, 200, await response.clone().text());
  const record = h.state.contexts.at(-1).files[0];
  h.state.tickets.set(ticketId, { intake_media: [record] });
  return record;
}

it('stores real PNG bytes privately with exact SHA-256 and redacts storage metadata', async (t) => {
  const h = await harness(t);
  const response = await h.send();
  assert.equal(response.status, 200);
  const body = await response.json();
  const record = h.state.contexts[0].files[0];
  assert.equal(record.sha256, sha(png));
  assert.equal(record.size, png.length);
  assert.equal(record.mime_type, 'image/png');
  assert.equal(record.source, 'customer');
  assert.match(record.storage_key, media.STORAGE_KEY);
  assert.deepEqual(fs.readFileSync(media.mediaPath(record.storage_key, h.root)), png);
  assert.equal(fs.statSync(media.mediaPath(record.storage_key, h.root)).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(media.mediaPath(record.storage_key, h.root))).mode & 0o777, 0o700);
  assert.equal(body.media[0].sha256, record.sha256);
  assert.equal(Object.hasOwn(body.media[0], 'storage_key'), false);
  assert.equal(JSON.stringify(body).includes(h.root), false);
});

it('detects MP4, MOV and WebM containers using the actual file-type module', async (t) => {
  const h = await harness(t);
  for (const file of [video(), video('camera.mov', mov, 'video/quicktime'), video('camera.webm', webm, 'video/webm')]) {
    const record = await uploadRecord(h, file);
    assert.equal(record.mime_type, file.mime);
    assert.equal(record.sha256, sha(file.bytes));
    assert.deepEqual(fs.readFileSync(media.mediaPath(record.storage_key, h.root)), file.bytes);
  }
});

it('rejects HTML disguised as JPEG, SVG and unsupported content with batch cleanup', async (t) => {
  const h = await harness(t);
  for (const file of [image('bad.jpg', Buffer.from('<html>active</html>'), 'image/jpeg'), image('bad.svg', Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml'), image('bad.png', Buffer.from('<svg/>'))]) {
    assert.equal((await h.send('/upload', form([image(), file]))).status, 400);
    await h.empty();
  }
});

it('rejects extension, declared MIME and detected MIME mismatches', async (t) => {
  const h = await harness(t);
  for (const file of [image('bad.jpg', png, 'image/jpeg'), image('bad.png', png, 'image/jpeg'), video('bad.mp4', png)]) {
    assert.equal((await h.send('/upload', form([file]))).status, 400);
    await h.empty();
  }
  assert.equal((await h.send('/upload', form([image('camera.png', png, 'application/octet-stream')]))).status, 200);
});

it('accepts exactly six files including two videos', async (t) => {
  const h = await harness(t);
  assert.equal((await h.send('/upload', form([image(), image(), image(), image(), video(), video()]))).status, 200);
  assert.equal(h.state.contexts[0].files.length, 6);
});

it('rejects seven files and three videos, cleaning all earlier files', async (t) => {
  const h = await harness(t);
  for (const files of [Array.from({ length: 7 }, () => image()), [image(), video(), video(), video()]]) {
    assert.equal((await h.send('/upload', form(files))).status, 400);
    await h.empty();
  }
});

it('enforces separate image and video byte limits during streaming', async (t) => {
  const h = await harness(t, { limits: { imageBytes: 80, videoBytes: 120 } });
  for (const file of [image('large.png', Buffer.concat([png, Buffer.alloc(100)])), video('large.mp4', Buffer.concat([mp4, Buffer.alloc(150)]))]) {
    assert.equal((await h.send('/upload', form([file]))).status, 413);
    await h.empty();
  }
});

it('enforces aggregate bytes with both content-length and chunked multipart requests', async (t) => {
  const h = await harness(t, { limits: { totalBytes: 100 } });
  assert.equal((await h.send('/upload', form([image(), image()]))).status, 413);
  await h.empty();
  const request = new Request(h.base + '/upload', { method: 'POST', body: form([image(), image()]) });
  const bytes = Buffer.from(await request.arrayBuffer());
  const status = await new Promise((resolve, reject) => {
    const req = http.request(h.base + '/upload', { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type'), 'Transfer-Encoding': 'chunked' } }, (res) => { res.resume(); res.once('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('chunked request timed out')));
    for (let start = 0; start < bytes.length; start += 17) req.write(bytes.subarray(start, start + 17));
    req.end();
  });
  assert.equal(status, 413);
  await h.empty();
});

it('requires explicit acknowledgment and removes rejected uploads', async (t) => {
  const h = await harness(t);
  for (const data of [{}, { media_acknowledged: 'false' }, { media_acknowledged: '1' }]) {
    assert.equal((await h.send('/upload', form([image()], data))).status, 400);
    await h.empty();
  }
});

it('bounds unknown fields and rejects unexpected file fields', async (t) => {
  const h = await harness(t);
  const many = Object.fromEntries(Array.from({ length: 21 }, (_, n) => [`unknown${n}`, 'x']));
  for (const body of [form([image()], many), form([image()], { unknown: 'x'.repeat(2049) }), form([{ ...image(), field: 'untrusted_media' }])]) {
    assert.equal((await h.send('/upload', body)).status, 400);
    await h.empty();
  }
});

it('rejects storage quota exhaustion before writing a batch', async (t) => {
  const h = await harness(t, { storageLimitBytes: 1 });
  assert.equal((await h.send()).status, 503);
  await h.empty();
  assert.equal(h.state.contexts[0].directory, null);
});

it('cleans an interrupted streaming upload and releases its concurrency slot', async (t) => {
  const h = await harness(t, { maxConcurrent: 1 });
  const req = http.request(h.base + '/upload', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=abort-test' } });
  req.on('error', () => {});
  t.after(() => req.destroy());
  req.write('--abort-test\r\nContent-Disposition: form-data; name="media"; filename="camera.png"\r\nContent-Type: image/png\r\n\r\n');
  req.write(png.subarray(0, 20));
  await waitFor(() => h.state.contexts[0]?.directory && fs.existsSync(h.state.contexts[0].directory) && fs.readdirSync(h.state.contexts[0].directory).length > 0, 'upload did not start writing');
  assert.equal((await h.send()).status, 429);
  req.destroy();
  await h.empty();
  assert.equal((await h.send()).status, 200);
});

it('public intake persists trusted evidence and invokes the committed callback', async (t) => {
  const h = await harness(t);
  const response = await h.send('/public/repair', form([image()], { ...fields, media_acknowledged: 'true', source: 'staff', sha256: 'forged' }));
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal((await response.json()).mediaCount, 1);
  const doc = h.state.saved[0];
  assert.equal(doc.status, 'don_web');
  assert.equal(doc.intake_media[0].sha256, sha(png));
  assert.equal(doc.intake_media[0].source, 'customer');
  assert.equal(doc.customer_submission.symptom, fields.symptom);
  assert.equal(doc.customer_submission.condition_at_intake, fields.condition_at_intake);
  assert.ok(doc.media_acknowledged_at instanceof Date);
  assert.equal(doc.media_acknowledgment_version, media.ACKNOWLEDGMENT_VERSION);
  assert.equal(h.state.contexts[0].committed, true);
  assert.ok(fs.existsSync(media.mediaPath(doc.intake_media[0].storage_key, h.root)));
  assert.equal(Object.hasOwn(h.service.mapTicket(doc).intake_media[0], 'storage_key'), false);
});

it('cleans files after validation failure and honeypot submission', async (t) => {
  const h = await harness(t);
  assert.equal((await h.send('/public/repair', form([image()], { ...fields, model_name: '', media_acknowledged: 'true' }))).status, 400);
  await h.empty();
  assert.equal((await h.send('/public/repair', form([image()], { ...fields, website: 'bot', media_acknowledged: 'true' }))).status, 201);
  await h.empty();
  assert.equal(h.state.saves, 0);
});

it('cleans files when customer lookup fails before ticket persistence begins', async (t) => {
  const h = await harness(t);
  h.state.customerError = new Error('customer lookup unavailable');
  assert.equal((await h.send('/public/repair', form([image()], { ...fields, media_acknowledged: 'true' }))).status, 500);
  assert.equal(h.state.saves, 0);
  await h.empty();
});

it('retains persisted evidence when email fails after onPersisted', async (t) => {
  const h = await harness(t);
  h.state.emailError = Object.assign(new Error('email unavailable'), { status: 503 });
  assert.equal((await h.send('/public/repair', form([image()], { ...fields, media_acknowledged: 'true' }))).status, 503);
  assert.equal(h.state.saved.length, 1);
  assert.equal(h.state.contexts[0].committed, true);
  assert.ok(fs.existsSync(media.mediaPath(h.state.saved[0].intake_media[0].storage_key, h.root)));
});

it('preserves JSON intake and ignores forged evidence in public and authenticated payloads', async (t) => {
  const h = await harness(t);
  const forged = { intake_media: [{ id: 'a'.repeat(32), storage_key: '../secret', sha256: 'forged' }], customer_submission: { model_name: 'forged' }, media_acknowledged_at: '2000-01-01', media_acknowledgment_version: 'forged' };
  assert.equal((await h.send('/public/repair', JSON.stringify({ ...fields, ...forged }), { 'Content-Type': 'application/json' })).status, 201);
  const first = h.state.saved[0];
  assert.equal(first.intake_media, undefined);
  assert.equal(first.customer_submission.model_name, fields.model_name);
  assert.equal(first.media_acknowledged_at, undefined);
  assert.equal(first.media_acknowledgment_version, undefined);
  const response = await h.send('/repairs', JSON.stringify({ ...forged, customer_name: 'Test Customer', customer_email: fields.email, model_name: fields.model_name, symptom: fields.symptom, skipEmail: true }), { ...h.auth(), 'Content-Type': 'application/json' });
  assert.equal(response.status, 201);
  assert.equal(h.state.saved[1].intake_media, undefined);
  assert.equal(h.state.saved[1].customer_submission, undefined);
  assert.equal(h.state.saved[1].media_acknowledged_at, undefined);
});

it('rate limits public intake before the upload middleware writes any bytes', async (t) => {
  const h = await harness(t);
  for (let n = 0; n < 8; n += 1) assert.equal((await h.send('/public/repair', JSON.stringify({ ...fields, website: 'bot' }), { 'Content-Type': 'application/json' })).status, 201);
  const calls = h.state.uploadCalls;
  const response = await h.send('/public/repair', form([image()], { ...fields, media_acknowledged: 'true' }));
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.equal(h.state.uploadCalls, calls);
  await h.empty();
});

it('requires a valid active session and restricts media downloads to staff roles', async (t) => {
  const h = await harness(t);
  const record = await uploadRecord(h);
  const url = `${h.base}/repairs/${ticketId}/media/${record.id}`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal(h.state.queries, 0);
  for (const role of ['customer', 'viewer', 'technician']) assert.equal((await fetch(url, { headers: h.auth(role) })).status, 403);
  for (const role of ['staff', 'admin', 'owner']) assert.equal((await fetch(url, { headers: h.auth(role) })).status, 200);
  const headers = h.auth();
  h.user.status = 'inactive';
  assert.equal((await fetch(url, { headers })).status, 401);
});

it('returns 404 for cross-ticket access, malformed IDs and traversal storage keys', async (t) => {
  const h = await harness(t);
  const record = await uploadRecord(h);
  h.state.tickets.set(otherTicketId, { intake_media: [] });
  for (const suffix of [`${otherTicketId}/media/${record.id}`, `invalid/media/${record.id}`, `${ticketId}/media/${'f'.repeat(32)}`, `${ticketId}/media/%2e%2e%2fsecret`]) {
    assert.equal((await fetch(`${h.base}/repairs/${suffix}`, { headers: h.auth() })).status, 404);
  }
  const original = record.storage_key;
  for (const key of ['../../secret.png', '/etc/passwd', `${'a'.repeat(32)}/../secret.png`, `${original}\n`]) {
    record.storage_key = key;
    assert.equal((await fetch(`${h.base}/repairs/${ticketId}/media/${record.id}`, { headers: h.auth() })).status, 404);
  }
});

it('serves exact original bytes, private no-store headers, safe attachment and ranges', async (t) => {
  const h = await harness(t);
  const record = await uploadRecord(h, video());
  const url = `${h.base}/repairs/${ticketId}/media/${record.id}`;
  const response = await fetch(url, { headers: h.auth() });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
  assert.equal(response.headers.get('x-content-sha256'), sha(mp4));
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), mp4);
  const range = await fetch(url, { headers: { ...h.auth(), Range: 'bytes=0-9' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), `bytes 0-9/${mp4.length}`);
  assert.equal(range.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), mp4.subarray(0, 10));
  const download = await fetch(url + '?download=1', { headers: h.auth() });
  assert.match(download.headers.get('content-disposition'), /^attachment;.*camera\.mp4/);
});

it('mongoose protects original evidence fields, nested values and media arrays on persisted documents', async () => {
  const original = { _id: ticketId, ticket_number: 'SRV-TEST', customer_name: 'Customer', customer_email: fields.email, model_name: 'Camera', symptom: 'Stuck', intake_media: [{ id: 'a'.repeat(32), storage_key: `${'b'.repeat(32)}/${'a'.repeat(32)}.png`, original_name: 'camera.png', mime_type: 'image/png', size: png.length, sha256: sha(png), uploaded_at: new Date(), source: 'customer' }], customer_submission: { submitted_at: new Date(), model_name: 'Camera', symptom: 'Stuck' }, media_acknowledged_at: new Date(), media_acknowledgment_version: media.ACKNOWLEDGMENT_VERSION };
  const doc = Ticket.hydrate(original);
  const before = doc.toObject();
  for (const field of ['intake_media', 'customer_submission', 'media_acknowledged_at', 'media_acknowledgment_version']) {
    assert.equal(Ticket.schema.path(field).options.immutable, true);
    doc.set(field, undefined);
    assert.deepEqual(doc.toObject()[field], before[field]);
  }
  doc.intake_media[0].sha256 = 'replaced';
  doc.customer_submission.model_name = 'replaced';
  assert.equal(doc.intake_media[0].sha256, before.intake_media[0].sha256);
  assert.equal(doc.customer_submission.model_name, before.customer_submission.model_name);
  doc.intake_media.push({ ...before.intake_media[0], id: 'f'.repeat(32) });
  await assert.rejects(doc.save(), /Không được thay đổi tư liệu khách đã gửi/);
});

it('receipt escapes untrusted names, includes full hashes and omits private keys and file URLs', () => {
  const { buildRepairIntakeEmailHtml } = require('../templates/repairServiceEmail');
  const privateKey = `${'b'.repeat(32)}/${'a'.repeat(32)}.png`;
  const uploadedAt = new Date('2026-10-21T04:05:06Z');
  const html = buildRepairIntakeEmailHtml({ ticket_number: 'SRV-TEST', customer_name: 'Customer', model_name: 'Camera', symptom: 'Stuck', condition_at_intake: '<script>condition</script>', createdAt: uploadedAt, intake_media: [{ original_name: '<img src=x onerror=alert(1)>.png', sha256: sha(png), uploaded_at: uploadedAt, storage_key: privateKey, url: 'https://private.invalid/original.png' }] }, { phase: 'order' });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;.png'));
  assert.ok(html.includes('&lt;script&gt;condition&lt;/script&gt;'));
  assert.equal(html.includes('<img src=x'), false);
  assert.ok(html.includes(sha(png)));
  assert.match(html, /1 file/);
  assert.ok(html.includes(uploadedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })));
  assert.ok(html.includes('Tình trạng khách khai'));
  assert.equal(html.includes(privateKey), false);
  assert.equal(html.includes('private.invalid'), false);
  assert.equal(html.includes('/media/'), false);
});

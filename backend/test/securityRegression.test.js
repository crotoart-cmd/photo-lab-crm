const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const { verifyToken } = require('../middleware/verifyToken');
const { resetRateLimitForTests } = require('../middleware/rateLimit');
const {
  assertSecurityEnv, trustedProxySetting, sanitizeApiErrors,
} = require('../middleware/security');
const { IMAGE_TYPES, uploadResponseHeaders } = require('../lib/uploads');
const { DELIVERY_TYPES, secureUpload } = require('../lib/uploads');

const projectRoot = path.resolve(__dirname, '../..');
const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'hdt-security-test-'));
const originalFindById = User.findById;
const originalFindOne = User.findOne;
const originalUpdateOne = User.updateOne;
const passwordHook = User.schema.s.hooks._pres.get('save').find((hook) => hook.fn.toString().includes('bcrypt.hash')).fn;
let account;
let accessory;

function runPasswordHook(user) {
  return new Promise((resolve, reject) => passwordHook.call(user, (err) => err ? reject(err) : resolve()));
}

function loadModule(relative, stubs) {
  const filename = path.join(projectRoot, relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  const factory = vm.runInThisContext(
    `(function(require, module, exports, __filename, __dirname) {${fs.readFileSync(filename, 'utf8')}\n})`,
    { filename }
  );
  factory((name) => Object.hasOwn(stubs, name) ? stubs[name] : localRequire(name), module, module.exports, filename, path.dirname(filename));
  return module.exports;
}

function testMulter(options) { return multer(options); }
testMulter.diskStorage = (options) => multer.diskStorage({
  ...options, destination: (_req, _file, cb) => cb(null, uploads),
});

const siteRouter = loadModule('backend/routes/siteContent.js', {
  fs: { ...fs, mkdirSync() {} },
  multer: testMulter,
  '../models/SiteContent': {
    findById: async () => accessory,
    create: async (fields) => ({ _id: 'new-content', ...fields }),
  },
});
const retailRouter = loadModule('backend/routes/retail.js', {
  fs: { ...fs, mkdirSync() {} },
  multer: testMulter,
  '../models/FilmStock': { find: () => { throw new Error('INTERNAL-TEST-DETAIL'); } },
  '../services/emailService': { formatEmailNote: () => '' },
  '../services/shopCatalog': { patchShopCard: async () => {}, listShopCatalog: async () => [] },
  './retailCatalog': express.Router(), './retailIntake': express.Router(), './retailSale': express.Router(),
});
const app = express();
app.set('trust proxy', false);
app.use(express.json());
app.use('/api', sanitizeApiErrors);
app.use('/api/auth', require('../routes/auth'));
app.use('/api/site-content', siteRouter);
app.use('/api/retail', retailRouter);
app.get('/api/private', verifyToken, (_req, res) => res.json({ ok: true }));
app.get('/ip', (req, res) => res.json({ ip: req.ip }));
app.use('/uploads/site', (req, res, next) => {
  if (!uploadResponseHeaders(res, req.path, IMAGE_TYPES)) return res.status(404).end();
  return next();
}, express.static(uploads));

async function withServer(fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function bearer(version = account.sessionVersion) {
  return { Authorization: `Bearer ${jwt.sign({ userId: account._id, sv: version }, process.env.JWT_SECRET, { expiresIn: '1h' })}` };
}

function multipart(filename, mime, content) {
  const form = new FormData();
  form.append('images', new Blob([content], { type: mime }), filename);
  return form;
}

beforeEach(async () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'test-only-random-looking-key-for-security-regressions';
  process.env.OWNER_PASSWORD = 'test-only-owner-password';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1/test-only-not-connected';
  delete process.env.DESKTOP_LOCAL;
  delete process.env.TRUST_PROXY;
  resetRateLimitForTests();
  account = new User({ name: 'Test User', email: 'audit@example.com', role: 'staff', password: 'original-test-password', status: 'active' });
  await runPasswordHook(account);
  account.isNew = false;
  account.unmarkModified('password');
  account.save = async () => {
    await runPasswordHook(account);
    account.unmarkModified('password');
    return account;
  };
  User.findById = () => ({ select: async () => account, then: (yes, no) => Promise.resolve(account).then(yes, no) });
  User.findOne = async () => account;
  User.updateOne = async () => { account.sessionVersion += 1; return { modifiedCount: 1 }; };
  accessory = { _id: 'accessory-test', type: 'accessory', title: 'Test', published: true,
    toObject() { return { ...this }; }, async save() {} };
});

after(() => {
  User.findById = originalFindById;
  User.findOne = originalFindOne;
  User.updateOne = originalUpdateOne;
  fs.rmSync(uploads, { recursive: true, force: true });
});

describe('session revocation', () => {
  it('keeps the changing mobile session logged in but rejects its previous token', async () => withServer(async (base) => {
    const old = bearer();
    const response = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH', headers: { ...old, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'replacement-test-password' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.token);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await fetch(`${base}/api/private`, { headers: old })).status, 401);
    assert.equal((await fetch(`${base}/api/private`, { headers: { Authorization: `Bearer ${body.token}` } })).status, 200);
  }));

  it('refreshes the browser cookie on password change without exposing a bearer token', async () => withServer(async (base) => {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: 'original-test-password' }),
    });
    const oldCookie = login.headers.get('set-cookie').split(';')[0];
    const response = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH', headers: { Cookie: oldCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'replacement-browser-password' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).token, undefined);
    const newCookie = response.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/api/private`, { headers: { Cookie: oldCookie } })).status, 401);
    assert.equal((await fetch(`${base}/api/private`, { headers: { Cookie: newCookie } })).status, 200);
  }));

  it('revokes tokens on logout', async () => withServer(async (base) => {
    const headers = bearer();
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 200);
    assert.equal((await fetch(`${base}/api/private`, { headers })).status, 401);
  }));

  it('rejects legacy tokens without a session version', async () => withServer(async (base) => {
    const token = jwt.sign({ userId: account._id }, process.env.JWT_SECRET);
    assert.equal((await fetch(`${base}/api/private`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  }));

  it('rejects a locked user even with a matching token version', async () => withServer(async (base) => {
    account.status = 'inactive';
    assert.equal((await fetch(`${base}/api/private`, { headers: bearer() })).status, 401);
  }));

  it('issues cookie-only browser login and versioned mobile login', async () => withServer(async (base) => {
    const login = async (client) => fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: 'original-test-password', client }),
    });
    const browser = await login('web');
    assert.equal(browser.status, 200);
    assert.equal((await browser.json()).token, undefined);
    assert.match(browser.headers.get('set-cookie'), /HttpOnly/);
    const mobile = await login('mobile');
    const body = await mobile.json();
    assert.equal(jwt.verify(body.token, process.env.JWT_SECRET).sv, account.sessionVersion);
  }));
});

describe('upload and content permissions', () => {
  for (const [filename, mime, content] of [
    ['test.js', 'application/javascript', 'alert(1)'],
    ['test.html', 'image/png', '<html>test</html>'],
    ['test.svg', 'image/svg+xml', '<svg></svg>'],
    ['test.jpg', 'image/jpeg', '<html>not an image</html>'],
  ]) {
    it(`rejects ${filename} and leaves no uploaded file`, async () => withServer(async (base) => {
      const before = fs.readdirSync(uploads);
      const response = await fetch(`${base}/api/retail/shop-catalog/film/test`, {
        method: 'PATCH', headers: bearer(), body: multipart(filename, mime, content),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(fs.readdirSync(uploads), before);
    }));
  }

  it('accepts a real PNG and serves it with a restrictive CSP', async () => withServer(async (base) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3uoAAAAASUVORK5CYII=', 'base64');
    const response = await fetch(`${base}/api/retail/shop-catalog/film/test`, {
      method: 'PATCH', headers: bearer(), body: multipart('real.png', 'image/png', png),
    });
    assert.equal(response.status, 200);
    const filename = fs.readdirSync(uploads).find((name) => name.endsWith('.png'));
    const image = await fetch(`${base}/uploads/site/${filename}`);
    assert.equal(image.status, 200);
    assert.match(image.headers.get('content-type'), /image\/png/);
    assert.match(image.headers.get('content-security-policy'), /sandbox/);
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  }));

  it('blocks pre-existing active files through the public upload path', async () => withServer(async (base) => {
    fs.writeFileSync(path.join(uploads, 'legacy.html'), '<html>legacy</html>');
    assert.equal((await fetch(`${base}/uploads/site/legacy.html`)).status, 404);
  }));

  it('bounds multipart array indexes before they can exhaust the parser', async () => withServer(async (base) => {
    const form = new FormData();
    form.append('metadata[4294967294]', 'test');
    form.append('metadata[key]', 'test');
    const response = await fetch(`${base}/api/retail/shop-catalog/film/test`, {
      method: 'PATCH', headers: bearer(), body: form,
    });
    assert.equal(response.status, 400);
  }));

  it('cleans a batch that exceeds the total upload size', async () => {
    const filename = path.join(uploads, 'oversized-test.jpg');
    fs.writeFileSync(filename, 'test');
    const req = { files: [{ path: filename, filename: 'oversized-test.jpg', size: 11 }] };
    const res = { status(code) { this.statusCode = code; return this; }, json() {} };
    const next = () => assert.fail('oversized batch must not reach the route');
    await secureUpload((_req, _res, done) => done(), DELIVERY_TYPES, 10)(req, res, next);
    assert.equal(res.statusCode, 413);
    assert.equal(fs.existsSync(filename), false);
  });

  it('rejects invalid types and forbids staff conversion to blog', async () => withServer(async (base) => {
    for (const type of ['invalid-type', 'BLOG', null, ['blog'], 'blog']) {
      const response = await fetch(`${base}/api/site-content/accessory-test`, {
        method: 'PATCH', headers: { ...bearer(), 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      });
      assert.equal(response.status, type === 'blog' ? 403 : 400);
      assert.equal(accessory.type, 'accessory');
    }
  }));

  it('preserves legitimate staff accessory edits and owner blog changes', async () => withServer(async (base) => {
    const update = (type) => fetch(`${base}/api/site-content/accessory-test`, {
      method: 'PATCH', headers: { ...bearer(), 'Content-Type': 'application/json' }, body: JSON.stringify({ type, title: 'Updated' }),
    });
    assert.equal((await update('accessory')).status, 200);
    account.role = 'owner';
    assert.equal((await update('blog')).status, 200);
    assert.equal(accessory.type, 'blog');
  }));
});

describe('deployment configuration and errors', () => {
  it('ignores spoofed forwarded IPs when no trusted proxy is configured', async () => withServer(async (base) => {
    assert.equal(trustedProxySetting(), false);
    const response = await fetch(`${base}/ip`, { headers: { 'X-Forwarded-For': '203.0.113.20' } });
    assert.equal((await response.json()).ip, '127.0.0.1');
  }));

  it('accepts explicit proxy addresses and rejects hop-count trust', () => {
    process.env.TRUST_PROXY = 'loopback,10.0.0.1';
    assert.deepEqual(trustedProxySetting(), ['loopback', '10.0.0.1']);
    process.env.TRUST_PROXY = '1';
    assert.throws(trustedProxySetting);
  });

  it('fails startup with a weak production secret or password', () => {
    const oldError = console.error;
    console.error = () => {};
    try {
      process.env.JWT_SECRET = 'short-test-secret';
      assert.throws(assertSecurityEnv);
      process.env.JWT_SECRET = 'valid-test-key-at-least-32-characters';
      process.env.OWNER_PASSWORD = '123456';
      assert.doesNotThrow(assertSecurityEnv);
      process.env.OWNER_PASSWORD = 'valid-test-owner-password';
      assert.doesNotThrow(assertSecurityEnv);
    } finally { console.error = oldError; }
  });

  it('sanitizes a real route catch response, not just the error helper', async () => withServer(async (base) => {
    const response = await fetch(`${base}/api/retail/film-stock`, { headers: bearer() });
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error, undefined);
    assert.equal(JSON.stringify(body).includes('INTERNAL-TEST-DETAIL'), false);
  }));
});

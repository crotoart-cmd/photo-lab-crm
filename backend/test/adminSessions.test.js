const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const AdminSession = require('../models/AdminSession');
const SecurityEvent = require('../models/SecurityEvent');
const { csrfProtection } = require('../middleware/csrf');
const { verifyToken } = require('../middleware/verifyToken');
const { flushAudit } = require('../middleware/authAudit');
const { resetRateLimitForTests } = require('../middleware/rateLimit');

const PASSWORD = 'test-only-session-password';
let mongo, server, base, owner, writes = 0;
const cookie = (response) => response.headers.get('set-cookie')?.split(';')[0];
async function request(path, { method = 'GET', body, session, headers = {} } = {}) {
  return fetch(base + '/api' + path, { method, headers: { ...(session ? { Cookie: session } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const login = (body = {}, headers) => request('/auth/login', { method: 'POST', body: { email: owner.email, password: PASSWORD, ...body }, headers });
async function csrf(session) {
  const response = await request('/auth/csrf', { session });
  assert.equal(response.status, 200);
  return { 'X-CSRF-Token': (await response.json()).csrfToken };
}
async function currentRecord(session) {
  const response = await request('/auth/sessions', { session });
  assert.equal(response.status, 200);
  const data = await response.json();
  return data.sessions.find((item) => item.current);
}

before(async () => {
  process.env.JWT_SECRET = 'test-only-independent-session-signing-secret';
  process.env.MFA_ENCRYPTION_KEY = '02'.repeat(32);
  process.env.JWT_EXPIRE = '7d';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = express();
  app.use(express.json());
  app.use('/api', csrfProtection);
  app.use('/api/auth', require('../routes/auth'));
  app.get('/api/private', verifyToken, (_req, res) => res.json({ ok: true }));
  app.post('/api/private', verifyToken, (_req, res) => res.json({ writes: ++writes }));
  app.post('/api/public/intake', (_req, res) => res.status(201).json({ accepted: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  await flushAudit();
  await Promise.all([User.deleteMany({}), AdminSession.deleteMany({}), SecurityEvent.deleteMany({})]);
  resetRateLimitForTests(); writes = 0;
  owner = await User.create({ name: 'Session Owner', email: 'sessions@example.test', password: PASSWORD, role: 'owner', status: 'active' });
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await flushAudit(); await mongoose.disconnect(); await mongo.stop();
});

test('web cookies and signed tokens expire after eight hours despite the native seven-day setting', async () => {
  const response = await login();
  const session = cookie(response);
  const decoded = jwt.verify(decodeURIComponent(session.split('=')[1]), process.env.JWT_SECRET);
  assert.equal(decoded.kind, 'web');
  assert.equal(decoded.exp - decoded.iat, 8 * 3600);
  assert.match(response.headers.get('set-cookie'), /Max-Age=28800/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  const record = await AdminSession.findOne().select('+sessionIdHash');
  assert.notEqual(record.sessionIdHash, decoded.sid);
  assert.equal(record.expiresAt - record.createdAt, 8 * 3600000);
  assert.equal((await response.json()).token, undefined);
});

test('idle web sessions cannot be revived by an activity header', async () => {
  const session = cookie(await login());
  const row = await currentRecord(session);
  await AdminSession.updateOne({ _id: row.id }, { $set: { lastSeenAt: new Date(Date.now() - 31 * 60000) } });
  assert.equal((await request('/private', { session, headers: { 'X-Session-Activity': '1' } })).status, 401);
});

test('the database absolute deadline is checked even before TTL cleanup', async () => {
  const session = cookie(await login());
  await AdminSession.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request('/private', { session, headers: { 'X-Session-Activity': '1' } })).status, 401);
});

test('background polling does not extend idle time; foreground activity does', async () => {
  const session = cookie(await login());
  const row = await currentRecord(session);
  const old = new Date(Date.now() - 5 * 60000);
  await AdminSession.updateOne({ _id: row.id }, { $set: { lastSeenAt: old } });
  assert.equal((await request('/private', { session })).status, 200);
  assert.equal((await AdminSession.findById(row.id)).lastSeenAt.getTime(), old.getTime());
  const active = await request('/private', { session, headers: { 'X-Session-Activity': '1' } });
  assert.equal(active.status, 200);
  assert.ok((await AdminSession.findById(row.id)).lastSeenAt > old);
  assert.ok(Date.parse(active.headers.get('x-session-idle-expires-at')) <= Date.now() + 30 * 60000);
});

test('logout revokes only the current web session', async () => {
  const first = cookie(await login()), second = cookie(await login());
  assert.equal((await request('/auth/logout', { method: 'POST', session: first, headers: await csrf(first) })).status, 200);
  assert.equal((await request('/private', { session: first })).status, 401);
  assert.equal((await request('/private', { session: second })).status, 200);
});

test('the owner can list and revoke other sessions without exposing secrets', async () => {
  const first = cookie(await login({}, { 'User-Agent': 'Chrome/123 Macintosh private-user-agent-value' }));
  const second = cookie(await login());
  const response = await request('/auth/sessions', { session: first });
  const data = await response.json();
  assert.deepEqual(data.policy, { idleMinutes: 30, maxHours: 8 });
  assert.equal(data.sessions.length, 2);
  const serialized = JSON.stringify(data);
  for (const hidden of ['sessionIdHash', 'sid', 'private-user-agent-value', PASSWORD]) assert.ok(!serialized.includes(hidden));
  const revoked = await request('/auth/sessions/others', { method: 'DELETE', session: first, headers: await csrf(first) });
  assert.equal((await revoked.json()).revoked, 1);
  assert.equal((await request('/private', { session: second })).status, 401);
  assert.equal((await request('/private', { session: first })).status, 200);
});

test('revoking a session cannot target a different account', async () => {
  const first = cookie(await login());
  const another = await User.create({ name: 'Other test owner', email: 'other@example.test', password: PASSWORD, role: 'owner', status: 'active' });
  const second = cookie(await login({ email: another.email }));
  const target = await currentRecord(second);
  const response = await request('/auth/sessions/' + target.id, { method: 'DELETE', session: first, headers: await csrf(first) });
  assert.equal((await response.json()).revoked, 0);
  assert.equal((await request('/private', { session: second })).status, 200);
});

test('revoking the current session clears its cookie and prevents reuse', async () => {
  const session = cookie(await login());
  const row = await currentRecord(session);
  const response = await request('/auth/sessions/' + row.id, { method: 'DELETE', session, headers: await csrf(session) });
  assert.equal((await response.json()).current, true);
  assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/private', { session, headers: { 'X-Session-Activity': '1' } })).status, 401);
});

test('cookie mutations need session-bound CSRF proof and a same-origin request', async () => {
  const session = cookie(await login());
  const headers = await csrf(session);
  const missing = await request('/private', { method: 'POST', session, body: {} });
  assert.equal(missing.status, 403);
  assert.equal((await missing.json()).code, 'CSRF_TOKEN_INVALID');
  assert.equal((await request('/private', { method: 'POST', session, body: {}, headers: { ...headers, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/auth/csrf', { session, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/private', { session, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal(writes, 0);
  assert.equal((await request('/private', { method: 'POST', session, body: {}, headers: { ...headers, Origin: base } })).status, 200);
  assert.equal(writes, 1);
});

test('production web cookies reject sibling-site origins even on private GET requests', async () => {
  const session = cookie(await login());
  const headers = await csrf(session);
  process.env.NODE_ENV = 'production';
  const host = new URL(base).host;
  assert.equal((await request('/private', { session, headers: { Origin: 'https://hdtlabx.com' } })).status, 403);
  assert.equal((await request('/private', { method: 'POST', session, body: {}, headers: { ...headers, Origin: 'https://hdtlabx.com' } })).status, 403);
  assert.equal((await request('/private', { session, headers: { Origin: `https://${host}` } })).status, 200);
  assert.equal((await request('/private', { session, headers: { Origin: base } })).status, 403);
});

test('CSRF proof from another session does not authorize a cookie mutation', async () => {
  const first = cookie(await login()), second = cookie(await login());
  assert.equal((await request('/private', { method: 'POST', session: second, body: {}, headers: await csrf(first) })).status, 403);
  assert.equal(writes, 0);
});

test('public forms without an authenticated cookie do not require a CSRF token', async () => {
  assert.equal((await request('/public/intake', { method: 'POST', body: { test: true } })).status, 201);
  const session = cookie(await login());
  assert.equal((await request('/public/intake', { method: 'POST', session, body: { test: true } })).status, 201);
});

test('cross-origin password login is rejected before credentials are checked', async () => {
  assert.equal((await login({}, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await login({}, { Origin: base })).status, 200);
});

test('native bearer sync and native media cookies retain their existing lifetime', async () => {
  const response = await login({ client: 'mobile' }, { Origin: 'capacitor://localhost' });
  const session = cookie(response);
  const { token } = await response.json();
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(decoded.kind, 'native');
  assert.equal(decoded.exp - decoded.iat, 7 * 86400);
  const sync = await request('/private', { method: 'POST', body: {}, headers: { Authorization: `Bearer ${token}` } });
  assert.equal(sync.status, 200);
  assert.equal((await request('/private', { session })).status, 200);
  assert.equal((await request('/private', { session, headers: { Origin: 'capacitor://localhost', 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  assert.equal((await request('/private', { session, headers: { 'X-Client': 'web' } })).status, 401);
  assert.equal((await request('/private', { method: 'POST', session, body: {} })).status, 403);
});

test('old web cookies require reauthentication; legacy native bearer expiry is not extended', async () => {
  const token = jwt.sign({ userId: owner._id, sv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await request('/private', { session: `hdtlabx_sid=${token}` })).status, 401);
  const response = await request('/private', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const bridge = jwt.verify(decodeURIComponent(cookie(response).split('=')[1]), process.env.JWT_SECRET);
  assert.equal(bridge.exp, jwt.verify(token, process.env.JWT_SECRET).exp);
});

test('security audit stores bounded metadata, never credentials, headers or OTPs', async () => {
  const response = await login();
  const session = cookie(response);
  await login({ password: 'wrong-password', code: '123456', currentPassword: PASSWORD });
  await flushAudit();
  const records = await SecurityEvent.find().select('+ipHash').lean();
  assert.ok(records.some((row) => row.event === 'login' && row.outcome === 'failure'));
  const serialized = JSON.stringify(records);
  for (const secret of [PASSWORD, 'wrong-password', '123456', session.split('=')[1], owner.email]) assert.ok(!serialized.includes(secret));
  assert.ok(records.every((row) => /^[a-f0-9]{64}$/.test(row.ipHash)));
  assert.ok(records.every((row) => Math.abs(row.expiresAt - row.createdAt - 90 * 86400000) < 1000));
  const history = await request('/auth/security-events', { session });
  assert.equal(history.status, 200);
  assert.ok(!JSON.stringify(await history.json()).includes('ipHash'));
});

test('staff cannot inspect owner sessions or audit history', async () => {
  await User.updateOne({ _id: owner._id }, { $set: { role: 'staff' } });
  const session = cookie(await login());
  assert.equal((await request('/auth/sessions', { session })).status, 403);
  assert.equal((await request('/auth/security-events', { session })).status, 403);
});

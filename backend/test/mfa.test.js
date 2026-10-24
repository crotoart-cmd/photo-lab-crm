const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const MfaChallenge = require('../models/MfaChallenge');
const mfa = require('../lib/mfa');
const { verifyToken } = require('../middleware/verifyToken');
const { resetRateLimitForTests } = require('../middleware/rateLimit');

const PASSWORD = 'test-only-owner-password';
let mongo, server, base, owner;
const cookie = (res) => res.headers.get('set-cookie')?.split(';')[0];
async function request(path, body, session, extraHeaders = {}) {
  return fetch(base + '/api/auth' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(session ? { Cookie: session } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function login(client) {
  return request('/login', { email: owner.email, password: PASSWORD, ...(client ? { client } : {}) });
}
async function status(session) {
  const res = await request('/mfa', undefined, session);
  assert.equal(res.status, 200);
  return res.json();
}
async function setup(session) {
  const state = await status(session);
  const res = await request('/mfa/setup', { currentPassword: PASSWORD }, session, { 'X-MFA-CSRF': state.csrfToken });
  assert.equal(res.status, 200);
  return { ...(await res.json()), csrf: state.csrfToken };
}
async function enroll() {
  const initial = await login();
  const oldCookie = cookie(initial);
  const pending = await setup(oldCookie);
  const res = await request('/mfa/enable', { code: mfa.totp(pending.secret).generate() }, oldCookie, { 'X-MFA-CSRF': pending.csrf });
  assert.equal(res.status, 200);
  const body = await res.json();
  return { oldCookie, session: cookie(res), secret: pending.secret, codes: body.recoveryCodes, body };
}
async function challenge(client) {
  const res = await login(client);
  assert.equal(res.status, 200);
  assert.equal(cookie(res), undefined);
  const body = await res.json();
  assert.equal(body.requiresMfa, true);
  assert.equal(body.token, undefined);
  return body.challengeToken;
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-only-mfa-jwt-key-not-used-in-production';
  process.env.MFA_ENCRYPTION_KEY = '01'.repeat(32);
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await MfaChallenge.init();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/users', require('../routes/users'));
  app.get('/private', verifyToken, (_req, res) => res.json({ ok: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  process.env.MFA_ENCRYPTION_KEY = '01'.repeat(32);
  resetRateLimitForTests();
  await User.deleteMany({});
  await MfaChallenge.deleteMany({});
  owner = await User.create({ name: 'Test Owner', email: 'mfa-owner@example.test', password: PASSWORD, role: 'owner', status: 'active' });
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await require('../middleware/authAudit').flushAudit();
  await mongoose.disconnect();
  await mongo?.stop();
});

test('existing owner remains able to log in until they confirm enrollment', async () => {
  const res = await login();
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.mfaEnabled, false);
  const state = await status(cookie(res));
  assert.equal(state.enabled, false);
  const pending = await setup(cookie(res));
  assert.match(pending.secret, /^[A-Z2-7]+$/);
  assert.match(pending.qrCode, /^data:image\/png;base64,/);
  assert.equal((await User.findById(owner._id)).mfaEnabled, false);
  const stored = await User.findById(owner._id).select(mfa.MFA_FIELDS);
  assert.ok(!stored.mfaPendingSecretEncrypted.includes(pending.secret));
  assert.equal(mfa.decryptSecret(stored.mfaPendingSecretEncrypted, owner._id), pending.secret);
  assert.throws(() => mfa.decryptSecret(stored.mfaPendingSecretEncrypted, new mongoose.Types.ObjectId()));
  assert.equal((await login()).status, 200);
});

test('an existing account without a stored session version can enroll without a data migration', async () => {
  await User.updateOne({ _id: owner._id }, { $unset: { sessionVersion: '' } });
  const enrolled = await enroll();
  assert.equal((await status(enrolled.session)).enabled, true);
  assert.equal((await User.findById(owner._id)).sessionVersion, 1);
});

test('settings require the current password, a session-bound CSRF token and a trusted origin', async () => {
  const session = cookie(await login());
  const state = await status(session);
  assert.equal((await request('/mfa/setup', { currentPassword: PASSWORD }, session)).status, 403);
  assert.equal((await request('/mfa/setup', { currentPassword: PASSWORD }, session, { 'X-MFA-CSRF': state.csrfToken, Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/mfa/setup', { currentPassword: 'wrong' }, session, { 'X-MFA-CSRF': state.csrfToken })).status, 400);
  const raw = JSON.stringify(await status(session));
  assert.ok(!raw.includes('secretEncrypted'));
  assert.ok(!raw.includes('recoveryCodeHashes'));
});

test('confirmation enables MFA, returns ten one-time backup codes and revokes old sessions', async () => {
  const result = await enroll();
  assert.equal(result.codes.length, 10);
  assert.equal(new Set(result.codes).size, 10);
  assert.equal(result.body.user.mfaEnabled, true);
  assert.equal(result.body.token, undefined);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: result.oldCookie } })).status, 401);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: result.session } })).status, 200);
  const stored = await User.findById(owner._id).select(mfa.MFA_FIELDS);
  assert.equal(stored.mfaRecoveryCodeHashes.length, 10);
  assert.ok(stored.mfaRecoveryCodeHashes.every((hash) => !result.codes.includes(hash)));
  assert.equal(stored.mfaPendingSecretEncrypted, undefined);
  assert.equal((await status(result.session)).recoveryCodesRemaining, 10);
});

test('expired enrollment cannot activate MFA', async () => {
  const session = cookie(await login());
  const pending = await setup(session);
  await User.updateOne({ _id: owner._id }, { $set: { mfaPendingExpiresAt: new Date(0) } });
  assert.equal((await request('/mfa/enable', { code: mfa.totp(pending.secret).generate() }, session, { 'X-MFA-CSRF': pending.csrf })).status, 400);
  assert.equal((await User.findById(owner._id)).mfaEnabled, false);
});

test('invalid enrollment code leaves the account password-only', async () => {
  const session = cookie(await login());
  const pending = await setup(session);
  assert.equal((await request('/mfa/enable', { code: 'invalid' }, session, { 'X-MFA-CSRF': pending.csrf })).status, 400);
  assert.equal((await User.findById(owner._id)).mfaEnabled, false);
});

test('password alone and a spoofed mobile client do not produce a full session', async () => {
  await enroll();
  const token = await challenge('mobile');
  assert.equal((await fetch(base + '/private', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await request('/mfa/login', { challengeToken: token, code: 'invalid', client: 'mobile' })).status, 401);
});

test('valid TOTP completes login once; concurrent replay is rejected', async () => {
  const enrolled = await enroll();
  await User.updateOne({ _id: owner._id }, { $set: { mfaLastUsedStep: -1 } });
  const token = await challenge();
  const code = mfa.totp(enrolled.secret).generate();
  const results = await Promise.all([request('/mfa/login', { challengeToken: token, code }), request('/mfa/login', { challengeToken: token, code })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  const success = results.find((r) => r.status === 200);
  assert.ok(cookie(success));
  assert.equal((await success.json()).token, undefined);
  assert.equal((await request('/mfa/login', { challengeToken: await challenge(), code })).status, 401);
});

test('backup codes are single use across concurrent login challenges', async () => {
  const enrolled = await enroll();
  const first = await challenge('mobile'), second = await challenge('mobile');
  const responses = await Promise.all([request('/mfa/login', { challengeToken: first, code: enrolled.codes[0] }), request('/mfa/login', { challengeToken: second, code: enrolled.codes[0] })]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
  const body = await responses.find((r) => r.status === 200).json();
  assert.equal(jwt.verify(body.token, process.env.JWT_SECRET).mfa, true);
  assert.equal((await status(enrolled.session)).recoveryCodesRemaining, 9);
});

test('login challenges expire and are limited to five guesses', async () => {
  await enroll();
  const token = await challenge();
  for (let i = 0; i < 5; i++) assert.equal((await request('/mfa/login', { challengeToken: token, code: 'invalid' })).status, 401);
  assert.equal((await request('/mfa/login', { challengeToken: token, code: 'invalid' })).status, 401);
  const another = await challenge();
  await MfaChallenge.updateMany({}, { $set: { expiresAt: new Date(0) } });
  assert.equal((await request('/mfa/login', { challengeToken: another, code: 'invalid' })).status, 401);
});

test('a per-account MFA limit survives creating additional login challenges', async () => {
  await enroll();
  await User.updateOne({ _id: owner._id }, { $set: { mfaAttempts: 10, mfaAttemptExpiresAt: new Date(Date.now() + 60000) } });
  assert.equal((await request('/mfa/login', { challengeToken: await challenge(), code: 'invalid' })).status, 429);
});

test('current-version password-only JWT is rejected for an MFA-enabled account', async () => {
  await enroll();
  const user = await User.findById(owner._id);
  const token = jwt.sign({ userId: user._id, sv: user.sessionVersion }, process.env.JWT_SECRET);
  assert.equal((await fetch(base + '/private', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
});

test('backup code rotation requires two factors and invalidates previous codes and sessions', async () => {
  const enrolled = await enroll();
  const state = await status(enrolled.session);
  const rotated = await request('/mfa/recovery-codes', { currentPassword: PASSWORD, code: enrolled.codes[0] }, enrolled.session, { 'X-MFA-CSRF': state.csrfToken });
  assert.equal(rotated.status, 200);
  const body = await rotated.json();
  assert.equal(body.recoveryCodes.length, 10);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: enrolled.session } })).status, 401);
  assert.equal((await request('/mfa/login', { challengeToken: await challenge(), code: enrolled.codes[1] })).status, 401);
  assert.equal((await request('/mfa/login', { challengeToken: await challenge(), code: body.recoveryCodes[0] })).status, 200);
});

test('disabling requires password and a second factor, then revokes all old sessions', async () => {
  const enrolled = await enroll();
  const state = await status(enrolled.session);
  const headers = { 'X-MFA-CSRF': state.csrfToken };
  assert.equal((await request('/mfa/disable', { currentPassword: PASSWORD }, enrolled.session, headers)).status, 400);
  const disabled = await request('/mfa/disable', { currentPassword: PASSWORD, code: enrolled.codes[0] }, enrolled.session, headers);
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).user.mfaEnabled, false);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: enrolled.session } })).status, 401);
  assert.ok(cookie(await login()));
});

test('password changes on an enrolled account require fresh proof and preserve MFA', async () => {
  const enrolled = await enroll();
  const state = await status(enrolled.session);
  const change = (extra) => fetch(base + '/api/auth/profile', { method: 'PATCH', headers: { Cookie: enrolled.session, 'Content-Type': 'application/json', 'X-MFA-CSRF': state.csrfToken }, body: JSON.stringify({ password: 'new-test-only-password', ...extra }) });
  assert.equal((await change({})).status, 400);
  const res = await change({ currentPassword: PASSWORD, code: enrolled.codes[0] });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.mfaEnabled, true);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: cookie(res) } })).status, 200);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: enrolled.session } })).status, 401);
});

test('credential changes invalidate pending challenges and cannot use the staff editor', async () => {
  const enrolled = await enroll();
  const token = await challenge();
  const state = await status(enrolled.session);
  const res = await fetch(base + '/api/auth/profile', { method: 'PATCH', headers: { Cookie: enrolled.session,
    'Content-Type': 'application/json', 'X-MFA-CSRF': state.csrfToken }, body: JSON.stringify({
    email: 'new-owner@example.test', currentPassword: PASSWORD, code: enrolled.codes[0] }) });
  assert.equal(res.status, 200);
  const session = cookie(res);
  assert.equal((await fetch(base + '/private', { headers: { Cookie: enrolled.session } })).status, 401);
  assert.equal((await request('/mfa/login', { challengeToken: token, code: enrolled.codes[1] })).status, 401);
  const bypass = await fetch(base + '/api/users/' + owner._id, { method: 'PATCH',
    headers: { Cookie: session, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'new-bypass-password' }) });
  assert.equal(bypass.status, 403);
});

test('enrolled login fails closed when the encryption key is unavailable', async () => {
  await enroll();
  const token = await challenge();
  delete process.env.MFA_ENCRYPTION_KEY;
  const res = await login();
  assert.ok(res.status >= 500);
  assert.equal(cookie(res), undefined);
  assert.equal((await request('/mfa/login', { challengeToken: token, code: '123456' })).status, 503);
});

test('wrong current password cannot disable MFA or replace backup codes', async () => {
  const enrolled = await enroll();
  const state = await status(enrolled.session);
  for (const operation of ['disable', 'recovery-codes']) {
    assert.equal((await request('/mfa/' + operation, { currentPassword: 'wrong', code: enrolled.codes[0] },
      enrolled.session, { 'X-MFA-CSRF': state.csrfToken })).status, 400);
  }
  assert.equal((await status(enrolled.session)).enabled, true);
  assert.equal((await status(enrolled.session)).recoveryCodesRemaining, 10);
});

test('staff cannot enroll and missing encryption configuration does not lock out an unenrolled owner', async () => {
  await User.updateOne({ _id: owner._id }, { $set: { role: 'staff' } });
  assert.equal((await request('/mfa', undefined, cookie(await login()))).status, 403);
  await User.updateOne({ _id: owner._id }, { $set: { role: 'owner' } });
  delete process.env.MFA_ENCRYPTION_KEY;
  const res = await login();
  assert.equal(res.status, 200);
  assert.equal((await status(cookie(res))).available, false);
});

test('enabling MFA and an MFA sign-in from a new device each send an alert without codes', async () => {
  const emailService = require('../services/emailService');
  const { flushAlerts } = require('../lib/securityAlerts');
  const original = emailService.sendMail;
  const sent = [];
  emailService.sendMail = async (mail) => { sent.push(mail); return { sent: true }; };
  try {
    const enrolled = await enroll();
    await flushAlerts();
    assert.ok(sent.some((mail) => /Đã bật Google Authenticator/.test(mail.subject)));
    sent.length = 0;
    const token = await challenge();
    await flushAlerts();
    assert.equal(sent.length, 0, 'the password step alone must not alert');
    const code = mfa.totp(enrolled.secret).generate({ timestamp: Date.now() + 30000 });
    const res = await fetch(base + '/api/auth/mfa/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone) Safari/17' },
      body: JSON.stringify({ challengeToken: token, code }) });
    assert.equal(res.status, 200);
    await flushAlerts();
    assert.equal(sent.length, 1);
    assert.match(sent[0].subject, /thiết bị mới/);
    const serialized = JSON.stringify(sent);
    for (const secret of [code, enrolled.secret, ...enrolled.codes, PASSWORD]) assert.ok(!serialized.includes(secret));
  } finally {
    emailService.sendMail = original;
  }
});

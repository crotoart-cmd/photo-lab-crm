const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const AdminSession = require('../models/AdminSession');
const SecurityEvent = require('../models/SecurityEvent');
const LoginThrottle = require('../models/LoginThrottle');
const emailService = require('../services/emailService');
const { flushAudit } = require('../middleware/authAudit');
const { flushAlerts } = require('../lib/securityAlerts');
const { resetRateLimitForTests } = require('../middleware/rateLimit');

const PASSWORD = 'test-only-alert-password';
const MAC = 'Mozilla/5.0 (Macintosh) Chrome/123';
const IPHONE = 'Mozilla/5.0 (iPhone) Safari/17';
const originalSendMail = emailService.sendMail;
let mongo, server, base, owner, sent, failSend;

async function request(path, { method = 'POST', body, session, ua = MAC } = {}) {
  resetRateLimitForTests();
  return fetch(base + '/api/auth' + path, { method, headers: { 'Content-Type': 'application/json', 'User-Agent': ua,
    ...(session ? { Cookie: session } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const login = (ua, password = PASSWORD) => request('/login', { body: { email: owner.email, password }, ua });
const cookie = (response) => response.headers.get('set-cookie')?.split(';')[0];
async function settle() { await flushAlerts(); await flushAudit(); }

before(async () => {
  process.env.JWT_SECRET = 'test-only-independent-alert-signing-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // Capture alerts in memory; no SMTP connection is made.
  emailService.sendMail = async (mail) => {
    if (failSend) throw new Error('test-only SMTP failure');
    sent.push(mail);
    return { sent: true };
  };
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  await settle();
  await Promise.all([User.deleteMany({}), AdminSession.deleteMany({}), SecurityEvent.deleteMany({}), LoginThrottle.deleteMany({})]);
  sent = []; failSend = false;
  owner = await User.create({ name: 'Alert Owner', email: 'alerts@example.test', password: PASSWORD, role: 'owner', status: 'active' });
});
after(async () => {
  emailService.sendMail = originalSendMail;
  await new Promise((resolve) => server.close(resolve));
  await settle(); await mongoose.disconnect(); await mongo.stop();
});

test('the first sign-in from a device sends one alert; the same device does not repeat it', async () => {
  assert.equal((await login(MAC)).status, 200);
  await settle();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, owner.email);
  assert.match(sent[0].subject, /thiết bị mới/);
  assert.match(sent[0].html, /Chrome · macOS/);
  assert.equal((await login(MAC)).status, 200);
  await settle();
  assert.equal(sent.length, 1);
  assert.equal((await login(IPHONE)).status, 200);
  await settle();
  assert.equal(sent.length, 2);
  assert.match(sent[1].html, /Safari · iOS/);
});

test('failed sign-ins send nothing and do not mark a device as known', async () => {
  assert.equal((await login(MAC, 'wrong-password')).status, 401);
  await settle();
  assert.equal(sent.length, 0);
  await login(MAC);
  await settle();
  assert.equal(sent.length, 1);
});

test('a password change alerts the account address', async () => {
  const session = cookie(await login(MAC));
  await settle(); sent = [];
  assert.equal((await request('/profile', { method: 'PATCH', session, body: { password: 'test-only-new-password' } })).status, 200);
  await settle();
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Mật khẩu/);
});

test('an email change alerts both the old and the new address', async () => {
  const session = cookie(await login(MAC));
  await settle(); sent = [];
  assert.equal((await request('/profile', { method: 'PATCH', session, body: { email: 'moved@example.test' } })).status, 200);
  await settle();
  assert.deepEqual(sent.map((m) => m.to).sort(), ['alerts@example.test', 'moved@example.test']);
});

test('a name-only change sends no alert', async () => {
  const session = cookie(await login(MAC));
  await settle(); sent = [];
  assert.equal((await request('/profile', { method: 'PATCH', session, body: { name: 'Renamed Owner' } })).status, 200);
  await settle();
  assert.equal(sent.length, 0);
});

test('alerts never contain secrets, addresses or raw user agents and escape markup', async () => {
  const ua = 'Mozilla/5.0 (Macintosh) Chrome/123 <script>secret-ua</script>';
  await login(ua);
  await settle();
  const mail = JSON.stringify(sent);
  for (const secret of [PASSWORD, '127.0.0.1', 'secret-ua', '<script>']) assert.ok(!mail.includes(secret));
  assert.match(sent[0].html, /\/profile/);
});

test('an SMTP failure never blocks sign-in', async () => {
  failSend = true;
  assert.equal((await login(MAC)).status, 200);
  await settle();
});

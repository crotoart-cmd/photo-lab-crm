const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const LoginThrottle = require('../models/LoginThrottle');
const { flushAudit } = require('../middleware/authAudit');
const { resetRateLimitForTests } = require('../middleware/rateLimit');
const { ACCOUNT_MAX, IP_MAX } = require('../lib/loginThrottle');

const PASSWORD = 'test-only-throttle-password';
let mongo, server, base, owner;

async function login(email, password, ip) {
  resetRateLimitForTests(); // isolate the shared Mongo budget from the per-process limiter
  return fetch(base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Test-Ip': ip } : {}) },
    body: JSON.stringify({ email, password }) });
}

before(async () => {
  process.env.JWT_SECRET = 'test-only-independent-throttle-signing-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = express();
  app.use(express.json());
  // Test-only: simulate distinct client addresses without trusting real proxy headers.
  app.use((req, _res, next) => {
    if (req.headers['x-test-ip']) Object.defineProperty(req, 'ip', { value: req.headers['x-test-ip'] });
    next();
  });
  app.use('/api/auth', require('../routes/auth'));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  await flushAudit();
  await Promise.all([User.deleteMany({}), LoginThrottle.deleteMany({})]);
  owner = await User.create({ name: 'Throttle Owner', email: 'throttle@example.test', password: PASSWORD, role: 'owner', status: 'active' });
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await flushAudit(); await mongoose.disconnect(); await mongo.stop();
});

test('an account is locked after repeated wrong passwords, even with the right one', async () => {
  for (let i = 0; i < ACCOUNT_MAX; i++) assert.equal((await login(owner.email, 'wrong-password')).status, 401);
  const locked = await login(owner.email, PASSWORD);
  assert.equal(locked.status, 429);
  assert.equal(locked.headers.get('retry-after'), '900');
});

test('the account budget is shared across client addresses', async () => {
  for (let i = 0; i < ACCOUNT_MAX; i++) await login(owner.email, 'wrong-password', `203.0.113.${i + 1}`);
  assert.equal((await login(owner.email, PASSWORD, '198.51.100.7')).status, 429);
});

test('the budget survives a process restart because it lives in the database', async () => {
  for (let i = 0; i < ACCOUNT_MAX; i++) await login(owner.email, 'wrong-password');
  resetRateLimitForTests();
  assert.equal(await LoginThrottle.countDocuments(), 1);
  assert.equal((await login(owner.email, PASSWORD)).status, 429);
});

test('the lock ends when the 15-minute window expires; it is never permanent', async () => {
  for (let i = 0; i < ACCOUNT_MAX; i++) await login(owner.email, 'wrong-password');
  await LoginThrottle.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await login(owner.email, PASSWORD)).status, 200);
});

test('a correct password clears earlier failures for that account', async () => {
  for (let i = 0; i < ACCOUNT_MAX - 1; i++) await login(owner.email, 'wrong-password');
  assert.equal((await login(owner.email, PASSWORD)).status, 200);
  for (let i = 0; i < ACCOUNT_MAX - 1; i++) assert.equal((await login(owner.email, 'wrong-password')).status, 401);
});

test('parallel guesses cannot exceed the account budget', async () => {
  const results = await Promise.all(Array.from({ length: ACCOUNT_MAX * 2 }, () => login(owner.email, 'wrong-password')));
  assert.equal(results.filter((r) => r.status === 401).length, ACCOUNT_MAX);
  assert.equal(results.filter((r) => r.status === 429).length, ACCOUNT_MAX);
});

test('one address spraying many accounts is blocked in production', async () => {
  process.env.NODE_ENV = 'production';
  for (let i = 0; i < IP_MAX; i++) await login(`nobody${i}@example.test`, 'wrong-password', '203.0.113.50');
  assert.equal((await login(owner.email, PASSWORD, '203.0.113.50')).status, 429);
  assert.equal((await login(owner.email, PASSWORD, '203.0.113.51')).status, 200);
});

test('stored keys are hashes, never the email or address', async () => {
  process.env.NODE_ENV = 'production';
  await login(owner.email, 'wrong-password', '203.0.113.9');
  const serialized = JSON.stringify(await LoginThrottle.find().lean());
  for (const raw of [owner.email, '203.0.113.9', 'wrong-password']) assert.ok(!serialized.includes(raw));
});

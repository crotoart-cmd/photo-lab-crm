const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { tooManyRequests, resetRateLimitForTests } = require('../middleware/rateLimit');

describe('rateLimit', () => {
  beforeEach(() => resetRateLimitForTests());

  it('allows requests under the cap then blocks', () => {
    const req = { ip: '203.0.113.10' };
    assert.equal(tooManyRequests(req, 3, 60_000, 't'), false);
    assert.equal(tooManyRequests(req, 3, 60_000, 't'), false);
    assert.equal(tooManyRequests(req, 3, 60_000, 't'), false);
    assert.equal(tooManyRequests(req, 3, 60_000, 't'), true);
  });

  it('uses req.ip after trust proxy, not spoofed X-Forwarded-For', () => {
    const req = {
      ip: '198.51.100.2',
      headers: { 'x-forwarded-for': '1.1.1.1' },
    };
    tooManyRequests(req, 1, 60_000, 'xff');
    const other = { ip: '198.51.100.2', headers: { 'x-forwarded-for': '8.8.8.8' } };
    assert.equal(tooManyRequests(other, 1, 60_000, 'xff'), true);
  });
});

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetRateLimitForTests } = require('../middleware/rateLimit');
const { publicIntakeIpBlocked, publicIntakeEmailBlocked } = require('../utils/webIntake');
const { isPublicFileLink } = require('../services/printOrderService');
const { issueCaptcha, verifyCaptcha, resetCaptchaForTests } = require('../lib/publicCaptcha');

describe('public intake limits', () => {
  const prev = process.env.NODE_ENV;
  beforeEach(() => {
    resetRateLimitForTests();
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => {
    process.env.NODE_ENV = prev;
    resetRateLimitForTests();
  });

  it('keeps a small cap for a real visitor address', () => {
    const req = { ip: '203.0.113.20' };
    for (let i = 0; i < 8; i += 1) assert.equal(publicIntakeIpBlocked(req, 'film'), false);
    assert.equal(publicIntakeIpBlocked(req, 'film'), true);
    assert.equal(publicIntakeIpBlocked({ ip: '203.0.113.21' }, 'film'), false);
  });

  it('does not let the hosting proxy address lock every visitor at 8 per hour', () => {
    const req = { ip: '127.0.0.1' };
    for (let i = 0; i < 80; i += 1) assert.equal(publicIntakeIpBlocked(req, 'shop'), false);
    assert.equal(publicIntakeIpBlocked(req, 'shop'), true);
  });

  it('caps repeats of the same email without storing the address', () => {
    for (let i = 0; i < 5; i += 1) assert.equal(publicIntakeEmailBlocked('Khach@Lab.test', 'print'), false);
    assert.equal(publicIntakeEmailBlocked('khach@lab.test', 'print'), true);
    assert.equal(publicIntakeEmailBlocked('khac@lab.test', 'print'), false);
  });
});

describe('public captcha', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-only-captcha-secret-not-used-elsewhere';
    resetCaptchaForTests();
  });

  it('accepts the issued answer once and rejects a replay', () => {
    const issued = issueCaptcha();
    assert.equal(verifyCaptcha(issued.token, issued.answer.toLowerCase()), true);
    assert.equal(verifyCaptcha(issued.token, issued.answer), false);
  });

  it('does not put the answer in the image payload', () => {
    const issued = issueCaptcha();
    assert.equal(issued.image.includes(issued.answer), false);
    assert.equal(issued.token.includes(issued.answer), false);
  });
});

describe('print file links', () => {
  it('accepts public https links and rejects local or cleartext targets', () => {
    assert.equal(isPublicFileLink('https://drive.google.com/file/d/abc'), true);
    assert.equal(isPublicFileLink('https://www.dropbox.com/s/abc'), true);
    for (const value of [
      'http://drive.google.com/file',
      'https://127.0.0.1/file',
      'https://192.168.1.10/file',
      'https://169.254.169.254/latest',
      'https://8.8.8.8/file',
      'https://2130706433/',
      'https://user:pass@drive.google.com/file',
      'javascript:alert(1)',
      '',
    ]) {
      assert.equal(isPublicFileLink(value), false, value);
    }
  });
});

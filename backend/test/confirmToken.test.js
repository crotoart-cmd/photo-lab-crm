const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  hashConfirmToken,
  issueConfirmToken,
  isPlausibleConfirmToken,
} = require('../lib/confirmToken');

describe('confirmToken', () => {
  it('hashes stably and does not echo the raw token', () => {
    const { raw, hash } = issueConfirmToken();
    assert.equal(raw.length, 64);
    assert.match(raw, /^[a-f0-9]+$/);
    assert.equal(hash, hashConfirmToken(raw));
    assert.notEqual(hash, raw);
    assert.equal(hash.length, 64);
  });

  it('rejects short or non-hex tokens', () => {
    assert.equal(isPlausibleConfirmToken(''), false);
    assert.equal(isPlausibleConfirmToken('abc'), false);
    assert.equal(isPlausibleConfirmToken('../etc/passwd'), false);
    assert.equal(isPlausibleConfirmToken('a'.repeat(32)), true);
  });
});

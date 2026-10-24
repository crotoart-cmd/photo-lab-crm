import test from 'node:test';
import assert from 'node:assert/strict';
import { mfaKeyMessage } from '../src/components/security/mfaKeyMessage.js';

test('a missing variable is reported with the exact name to add', () => {
  assert.match(mfaKeyMessage({ available: false, keyProblem: 'missing', keyNames: [] }), /chưa có biến MFA_ENCRYPTION_KEY/);
});

test('a similarly named variable is quoted so stray spaces or case differences are visible', () => {
  const message = mfaKeyMessage({ available: false, keyProblem: 'missing', keyNames: ['MFA_ENCRYPTION_KEY ', 'mfa_encryption_key'] });
  assert.ok(message.includes('"MFA_ENCRYPTION_KEY "'));
  assert.ok(message.includes('"mfa_encryption_key"'));
});

test('wrong length and wrong characters give a specific instruction', () => {
  assert.match(mfaKeyMessage({ keyProblem: 'length', keyLength: 63 }), /có 63 ký tự, cần đúng 64/);
  assert.match(mfaKeyMessage({ keyProblem: 'not_hex' }), /chỉ được dùng 0-9 và a-f/);
});

test('an older server response keeps the generic message', () => {
  assert.equal(mfaKeyMessage({ available: false }), 'Máy chủ chưa cấu hình khóa mã hóa 2FA.');
  assert.equal(mfaKeyMessage(null), 'Máy chủ chưa cấu hình khóa mã hóa 2FA.');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineMfaBlock } from '../src/lib/offlineMfa.js';

test('offline login stays closed when 2FA is on or unknown', () => {
  assert.equal(offlineMfaBlock(null), null);
  assert.equal(offlineMfaBlock({ mfaEnabled: false, user: { mfaEnabled: false } }), null);
  assert.equal(offlineMfaBlock({ mfaEnabled: true, user: { mfaEnabled: false } }), 'mfa');
  assert.equal(offlineMfaBlock({ user: { mfaEnabled: true } }), 'mfa');
  assert.equal(offlineMfaBlock({ user: {} }), 'unknown');
});

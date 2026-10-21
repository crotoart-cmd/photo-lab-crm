import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicLanguage, localizedPublicSearch, readPublicLang, writePublicLang } from '../src/lib/publicLanguage.js';

test('explicit language, saved preference, browser region, then English', () => {
  assert.equal(resolvePublicLanguage({ query: 'en', saved: 'vi', languages: ['de-DE'] }), 'en');
  assert.equal(resolvePublicLanguage({ saved: 'es', languages: ['vi-VN'] }), 'es');
  assert.equal(resolvePublicLanguage({ languages: ['vi-VN', 'en-US'] }), 'vi');
  assert.equal(resolvePublicLanguage({ languages: ['de-AT'] }), 'de');
  assert.equal(resolvePublicLanguage({ languages: ['es-MX'] }), 'es');
  assert.equal(resolvePublicLanguage({ languages: ['en-GB', 'vi-VN'] }), 'en');
  assert.equal(resolvePublicLanguage({ languages: ['fr-FR', 'ja-JP'] }), 'en');
  assert.equal(resolvePublicLanguage({ query: 'bad', saved: 'bad' }), 'en');
  assert.equal(resolvePublicLanguage(), 'en');
});

test('language navigation retains other query parameters without duplicate lang', () => {
  const query = localizedPublicSearch('?site=public&lang=en&utm_source=mail', 'vi');
  const params = new URLSearchParams(query);
  assert.equal(params.get('site'), 'public');
  assert.equal(params.get('utm_source'), 'mail');
  assert.deepEqual(params.getAll('lang'), ['vi']);
  assert.equal(localizedPublicSearch('', 'bad'), '?lang=en');
});

test('disabled storage does not prevent language detection or manual switching', () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('disabled'); } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['vi-VN'] } });
  try {
    assert.equal(readPublicLang(), 'vi');
    assert.equal(readPublicLang('en'), 'en');
    assert.doesNotThrow(() => writePublicLang('en'));
  } finally {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
  }
});

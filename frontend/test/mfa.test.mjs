import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('production admin cannot opt into offline auth and MFA challenge does not become a logged-in session', async () => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  const values = new Map([['hdtlabx_offline_mode', '1']]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  globalThis.window = { location: { hostname: 'admin.hdtlabx.com', pathname: '/login', search: '?local=1', origin: 'https://admin.hdtlabx.com' } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null } });
  try {
    const { isMobileDataEnabled } = await server.ssrLoadModule('/src/lib/mobileLocalDb.js');
    assert.equal(isMobileDataEnabled(), false);
    const { default: api } = await server.ssrLoadModule('/src/api/client.js');
    const { AuthProvider, useAuth } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    let auth;
    function Probe() { auth = useAuth(); return null; }
    renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(Probe)));
    const requests = [];
    api.defaults.adapter = async (config) => {
      requests.push({ url: config.url, body: JSON.parse(config.data) });
      return { config, status: 200, statusText: 'OK', headers: {}, data: config.url === '/auth/login'
        ? { requiresMfa: true, challengeToken: 'test-only-challenge' }
        : { user: { id: 'test-owner', name: 'Owner', role: 'owner', mfaEnabled: true } } };
    };
    const result = await auth.login('owner@example.test', 'test-only-password');
    assert.equal(result.requiresMfa, true);
    assert.equal(values.has('user'), false);
    assert.equal(values.has('token'), false);
    await assert.rejects(auth.loginOfflineOnly('owner@example.test', 'test-only-password'));
    assert.equal(auth.continueOffline(), false);
    await auth.completeMfaLogin(result.challengeToken, '123456');
    assert.deepEqual(requests[1], { url: '/auth/mfa/login', body: { challengeToken: 'test-only-challenge', code: '123456' } });
    assert.equal(JSON.parse(values.get('user')).mfaEnabled, true);
    assert.equal(values.has('token'), false);
    assert.equal(values.has('test-only-challenge'), false);
    const { default: MfaCodeField } = await server.ssrLoadModule('/src/components/security/MfaCodeField.jsx');
    const otp = renderToStaticMarkup(React.createElement(MfaCodeField, { value: '', onChange() {}, recovery: false, onRecoveryChange() {} }));
    assert.match(otp, /autoComplete="one-time-code"/i);
    assert.match(otp, /inputMode="numeric"/i);
    assert.match(otp, /maxLength="6"/i);
    const backup = renderToStaticMarkup(React.createElement(MfaCodeField, { value: '', onChange() {}, recovery: true, onRecoveryChange() {} }));
    assert.match(backup, /Mã dự phòng/);
    assert.match(backup, /maxLength="43"/i);
  } finally {
    await server.close();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  }
});

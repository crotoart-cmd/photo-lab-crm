import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('admin activity, CSRF proof, retry boundaries and stale responses preserve web session security', async () => {
  const previous = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage, CustomEvent: globalThis.CustomEvent };
  const values = new Map([['user', JSON.stringify({ id: 'test-owner', role: 'owner' })], ['token', 'old-web-token-must-not-be-sent']]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  globalThis.window = Object.assign(new EventTarget(), { location: { hostname: 'admin.hdtlabx.com', origin: 'https://admin.hdtlabx.com', pathname: '/profile', search: '', href: 'https://admin.hdtlabx.com/profile' } });
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  globalThis.CustomEvent = class extends Event { constructor(type, options) { super(type); this.detail = options.detail; } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null } });
  let stopTracking;
  try {
    const activity = await server.ssrLoadModule('/src/lib/adminSessionActivity.js');
    assert.equal(activity.hasRecentAdminActivity(), false);
    stopTracking = activity.trackAdminActivity(() => {});
    assert.equal(activity.adminActivityHeader(), '1');
    assert.equal(activity.adminActivityHeader(), '0', 'a background request must not reuse old interaction');
    document.visibilityState = 'hidden';
    assert.equal(activity.hasRecentAdminActivity(), false);
    assert.equal(activity.adminActivityHeader(), '0');
    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(activity.hasRecentAdminActivity(), true);

    const { getServerAuthToken } = await server.ssrLoadModule('/src/utils/authToken.js');
    assert.equal(getServerAuthToken(), null);
    const { default: api } = await server.ssrLoadModule('/src/api/client.js');
    const requests = [];
    let nonce = 0, rejectProof = false, oldReject, oldStarted;
    const started = new Promise((resolve) => { oldStarted = resolve; });
    const error = (config, status, code) => Object.assign(new Error('test-only HTTP response'), { config, response: { config, status, data: { code } } });
    api.defaults.adapter = async (config) => {
      requests.push({ url: config.url, csrf: config.headers.get('X-CSRF-Token'), authorization: config.headers.get('Authorization'), activity: config.headers.get('X-Session-Activity') });
      if (config.url === '/old-private') return new Promise((_resolve, reject) => { oldReject = () => reject(error(config, 401)); oldStarted(); });
      if (config.url === '/new-private') throw error(config, 401);
      if (config.url === '/blocked-origin') throw error(config, 403, 'CSRF_ORIGIN_INVALID');
      if (config.url === '/films' && rejectProof) { rejectProof = false; throw error(config, 403, 'CSRF_TOKEN_INVALID'); }
      return { config, status: 200, statusText: 'OK', headers: {}, data: config.url === '/auth/csrf' ? { csrfToken: `proof-${++nonce}` } : { user: { id: 'test-owner', role: 'owner' } } };
    };
    await api.post('/films', { test: true });
    assert.equal(nonce, 1);
    assert.equal(requests.at(-1).csrf, 'proof-1');
    assert.equal(requests.at(-1).authorization, undefined);
    await api.patch('/inventory/test', { test: true });
    assert.equal(nonce, 1, 'proof is held only in memory and reused within a session');
    rejectProof = true;
    await api.post('/films', { test: true });
    assert.equal(nonce, 2);
    assert.equal(requests.at(-1).csrf, 'proof-2');
    const before = requests.length;
    await assert.rejects(api.post('/blocked-origin', {}));
    assert.equal(requests.length, before + 1, 'origin failures must never retry mutations');
    await api.post('/public/repair', {});
    assert.equal(requests.at(-1).csrf, undefined);
    await api.post('https://untrusted.example/api/films', {});
    assert.equal(requests.at(-1).csrf, undefined, 'do not transmit CSRF proof to another origin');
    assert.equal(requests.at(-1).authorization, undefined);
    assert.equal(values.has('csrfToken'), false);

    const pending = api.get('/old-private');
    await started;
    await api.post('/auth/login', { email: 'owner@example.test', password: 'test-only' });
    values.set('user', JSON.stringify({ id: 'fresh-owner' }));
    oldReject();
    await assert.rejects(pending);
    assert.equal(JSON.parse(values.get('user')).id, 'fresh-owner', 'an old request cannot log out a freshly rotated session');
    await assert.rejects(api.get('/new-private'));
    assert.equal(values.has('user'), false);
    assert.equal(window.location.href, '/login');

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { default: SessionSettings } = await server.ssrLoadModule('/src/components/security/SessionSettings.jsx');
    const markup = renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(SessionSettings)));
    assert.match(markup, /30 phút/);
    assert.match(markup, /8 giờ/);
    assert.match(markup, /Nhật ký/);
  } finally {
    stopTracking?.(); await server.close();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

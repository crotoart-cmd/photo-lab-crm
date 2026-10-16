import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('mobile password changes refresh the server token and offline password together', async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    Capacitor: { isNativePlatform: () => true },
    location: { hostname: 'localhost', pathname: '/profile', search: '', origin: 'http://localhost' },
  };
  const root = fileURLToPath(new URL('../', import.meta.url));
  const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null } });
  try {
    const { default: api } = await server.ssrLoadModule('/src/api/client.js');
    const auth = await server.ssrLoadModule('/src/lib/mobileOfflineAuth.js');
    const user = { id: 'test-only', email: 'audit@example.com', role: 'staff' };
    await auth.saveOfflineCredentials(user.email, 'old-test-password', user);
    localStorage.setItem('token', 'old-test-token');
    api.defaults.adapter = async (config) => ({
      data: { token: 'new-test-token', user }, status: 200, statusText: 'OK', headers: {}, config,
    });
    await api.patch('/auth/profile', { password: 'new-test-password' });
    assert.equal(localStorage.getItem('token'), 'new-test-token');
    assert.equal(localStorage.getItem('nuocleo_server_jwt'), 'new-test-token');
    assert.equal(await auth.verifyOfflineLogin(user.email, 'old-test-password'), null);
    assert.equal((await auth.verifyOfflineLogin(user.email, 'new-test-password')).user.role, 'staff');
  } finally {
    await server.close();
    delete globalThis.localStorage;
    delete globalThis.window;
  }
});

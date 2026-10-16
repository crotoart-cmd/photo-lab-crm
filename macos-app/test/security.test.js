const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { loadDesktopSecurity } = require('../electron/securityConfig');
const { createUiApp } = require('../electron/uiServer');

it('creates private, stable credentials unique to each desktop installation', () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'hdt-desktop-first-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'hdt-desktop-second-'));
  try {
    const a = loadDesktopSecurity(first);
    const b = loadDesktopSecurity(second);
    assert.notEqual(a.jwtSecret, b.jwtSecret);
    assert.notEqual(a.ownerPassword, b.ownerPassword);
    assert.deepEqual(loadDesktopSecurity(first), a);
    assert.equal(fs.statSync(path.join(first, 'desktop-security.json')).mode & 0o777, 0o600);
    assert.ok(a.ownerPassword.length >= 16);
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});

it('refuses malformed existing credentials instead of silently replacing them', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hdt-desktop-invalid-'));
  try {
    fs.writeFileSync(path.join(directory, 'desktop-security.json'), '{}');
    assert.throws(() => loadDesktopSecurity(directory));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

it('proxies API paths, JSON bodies and cookies without changing desktop routes', async () => {
  const backend = express();
  backend.use(express.json());
  backend.post('/api/test', (req, res) => {
    res.cookie('audit-cookie', 'test-only', { httpOnly: true });
    res.json({ path: req.path, body: req.body });
  });
  const api = backend.listen(0, '127.0.0.1');
  await new Promise((resolve) => api.once('listening', resolve));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hdt-desktop-ui-'));
  const ui = createUiApp(directory, `http://127.0.0.1:${api.address().port}`).listen(0, '127.0.0.1');
  await new Promise((resolve) => ui.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${ui.address().port}/api/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marker: 'test' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path: '/api/test', body: { marker: 'test' } });
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  } finally {
    await new Promise((resolve) => ui.close(resolve));
    await new Promise((resolve) => api.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

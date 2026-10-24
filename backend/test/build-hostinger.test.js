const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildMode } = require('../scripts/build-hostinger.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hdtlabx-build-'));
  const backend = path.join(root, 'backend');
  fs.mkdirSync(backend);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, backend };
}

test('full repository builds frontend even when previous compiled assets exist', (t) => {
  const { root, backend } = fixture(t);
  fs.mkdirSync(path.join(root, 'frontend'));
  fs.writeFileSync(path.join(root, 'frontend/package.json'), '{}');
  fs.mkdirSync(path.join(backend, 'public/assets'), { recursive: true });
  fs.writeFileSync(path.join(backend, 'public/index.html'), '<html></html>');
  assert.equal(buildMode(backend), 'source');
});

test('environment-only rebuild keeps compiled assets without sibling frontend', (t) => {
  const { backend } = fixture(t);
  fs.mkdirSync(path.join(backend, 'public/assets'), { recursive: true });
  fs.writeFileSync(path.join(backend, 'public/index.html'), '<html></html>');
  assert.equal(buildMode(backend), 'prebuilt');
});

test('missing frontend and compiled bundle fail instead of publishing Cannot GET', (t) => {
  const { backend } = fixture(t);
  assert.throws(() => buildMode(backend), /Redeploy from GitHub/);
});

test('an index without its assets is not accepted as a compiled bundle', (t) => {
  const { backend } = fixture(t);
  fs.mkdirSync(path.join(backend, 'public'));
  fs.writeFileSync(path.join(backend, 'public/index.html'), '<html></html>');
  assert.throws(() => buildMode(backend), /Redeploy from GitHub/);
});

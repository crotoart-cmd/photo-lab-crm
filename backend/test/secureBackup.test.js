const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { encrypt, decrypt, readKey, HEADER_SIZE } = require('../../scripts/secure-backup.cjs');
let root, key, destination;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'hdt-backup-test-')); key = crypto.randomBytes(32); destination = path.join(root, 'data.hdtbackup'); });
afterEach(async () => { key.fill(0); await fs.rm(root, { recursive: true, force: true }); });

test('backup encryption round-trips arbitrary binary data with restrictive permissions', async () => {
  const data = crypto.randomBytes(1024 * 1024 + 17), output = path.join(root, 'restored.bson');
  await encrypt(Readable.from([data]), destination, key);
  assert.equal((await fs.stat(destination)).mode & 0o777, 0o600);
  assert.equal((await decrypt(destination, null, key)).verified, true);
  await decrypt(destination, output, key);
  assert.deepEqual(await fs.readFile(output), data);
});

test('empty archives can be authenticated and decrypted', async () => {
  await encrypt(Readable.from([]), destination, key);
  await decrypt(destination, path.join(root, 'empty'), key);
  assert.equal((await fs.readFile(path.join(root, 'empty'))).length, 0);
});

test('each backup uses fresh randomness even with the same input and key', async () => {
  await encrypt(Readable.from(['same input']), destination, key);
  await encrypt(Readable.from(['same input']), path.join(root, 'other'), key);
  assert.notDeepEqual(await fs.readFile(destination), await fs.readFile(path.join(root, 'other')));
});

for (const part of ['header', 'ciphertext', 'tag', 'truncated', 'wrong-key']) test(`backup rejects ${part} without publishing unauthenticated plaintext`, async () => {
  await encrypt(Readable.from(['sensitive-test-data']), destination, key);
  const data = await fs.readFile(destination);
  if (part === 'header') data[HEADER_SIZE - 1] ^= 1;
  if (part === 'ciphertext') data[HEADER_SIZE + 1] ^= 1;
  if (part === 'tag') data[data.length - 1] ^= 1;
  await fs.writeFile(destination, part === 'truncated' ? data.subarray(0, 10) : data);
  const output = path.join(root, 'must-not-exist');
  await assert.rejects(decrypt(destination, output, part === 'wrong-key' ? crypto.randomBytes(32) : key));
  await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  assert.deepEqual((await fs.readdir(root)).sort(), ['data.hdtbackup']);
});

test('existing backup and restore files are never overwritten', async () => {
  await encrypt(Readable.from(['original']), destination, key);
  const original = await fs.readFile(destination);
  await assert.rejects(encrypt(Readable.from(['replacement']), destination, key), { code: 'EEXIST' });
  assert.deepEqual(await fs.readFile(destination), original);
  const output = path.join(root, 'restore'); await fs.writeFile(output, 'keep');
  await assert.rejects(decrypt(destination, output, key), { code: 'EEXIST' });
  assert.equal(await fs.readFile(output, 'utf8'), 'keep');
});

test('a failed source stream never leaves a completed-looking backup', async () => {
  const broken = Readable.from((async function* () { yield 'incomplete'; throw new Error('source failed'); })());
  await assert.rejects(encrypt(broken, destination, key));
  assert.deepEqual(await fs.readdir(root), []);
});

test('explicit key file creation is private, reusable and never replaces an existing key', async () => {
  const keyFile = path.join(root, 'secrets', 'key');
  const first = readKey({ keyFile, create: true });
  assert.equal((await fs.stat(path.dirname(keyFile))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(keyFile)).mode & 0o777, 0o600);
  assert.deepEqual(readKey({ keyFile, create: true }), first);
  await fs.chmod(keyFile, 0o644);
  assert.throws(() => readKey({ keyFile }), /0600/);
  await fs.chmod(keyFile, 0o600); await fs.writeFile(keyFile, 'invalid');
  assert.throws(() => readKey({ keyFile, create: true }), /Invalid/);
  assert.equal(await fs.readFile(keyFile, 'utf8'), 'invalid');
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Writable } = require('node:stream');

const SERVICE = 'HDTLABX Backup Encryption';
const ACCOUNT = 'hdtlabx-backup-v1';
const MAGIC = Buffer.from('HDTLABXBACKUP1\n');
const HEADER_SIZE = MAGIC.length + 16 + 12;
const TAG_SIZE = 16;

function fileKey(keyFile, create) {
  if (!path.isAbsolute(keyFile)) throw new Error('Use an absolute key file path.');
  const directory = path.dirname(keyFile);
  if (create) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const parent = fs.lstatSync(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) || parent.uid !== process.getuid()) throw new Error('Key directory must be owned by you with mode 0700.');
  if (create && !fs.existsSync(keyFile)) {
    const fd = fs.openSync(keyFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    const key = crypto.randomBytes(32);
    try { fs.writeFileSync(fd, key.toString('hex')); fs.fsyncSync(fd); }
    finally { key.fill(0); fs.closeSync(fd); }
  }
  const fd = fs.openSync(keyFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) || stat.uid !== process.getuid()) throw new Error('Key file must be owned by you with mode 0600.');
    const value = fs.readFileSync(fd, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid key file; do not replace it.');
    return Buffer.from(value, 'hex');
  } finally { fs.closeSync(fd); }
}

function readKey({ create = false, keyFile } = {}) {
  if (keyFile) return fileKey(keyFile, create);
  const result = spawnSync('/usr/bin/security', ['find-generic-password', '-a', ACCOUNT, '-s', SERVICE, '-w'], { encoding: 'utf8' });
  if (result.status === 0) {
    const value = result.stdout.trim();
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Backup key format is invalid. Do not replace the existing key.');
    return Buffer.from(value, 'hex');
  }
  if (!create || result.status !== 44) throw new Error('Backup key is unavailable. Unlock Keychain or approve access; no key was replaced.');
  const key = crypto.randomBytes(32);
  // Interactive stdin keeps the key out of process arguments, shell history and logs.
  const command = `add-generic-password -a "${ACCOUNT}" -s "${SERVICE}" -l "${SERVICE}" -T /usr/bin/security -w "${key.toString('hex')}"\n`;
  const added = spawnSync('/usr/bin/security', ['-i'], { input: command, encoding: 'utf8' });
  const stored = readKey();
  if (added.status !== 0 || !crypto.timingSafeEqual(key, stored)) throw new Error('Backup key could not be saved and verified.');
  key.fill(0);
  return stored;
}

function subkey(key, header) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A 256-bit backup key is required.');
  return Buffer.from(crypto.hkdfSync('sha256', key, header.subarray(MAGIC.length, MAGIC.length + 16), 'hdtlabx:backup:aes-256-gcm:v1', 32));
}

async function privateTemp(destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${crypto.randomBytes(12).toString('hex')}.partial`;
  return { temporary, output: fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }) };
}

async function publish(temporary, destination) {
  // link() fails atomically if the destination exists; never overwrite an older backup.
  await fsp.link(temporary, destination);
  await fsp.unlink(temporary);
}

async function encrypt(source, destination, key) {
  const header = Buffer.concat([MAGIC, crypto.randomBytes(16), crypto.randomBytes(12)]);
  const derived = subkey(key, header);
  const cipher = crypto.createCipheriv('aes-256-gcm', derived, header.subarray(HEADER_SIZE - 12));
  cipher.setAAD(header);
  const { temporary, output } = await privateTemp(destination);
  try {
    output.write(header);
    await pipeline(source, cipher, output);
    await fsp.appendFile(temporary, cipher.getAuthTag());
    await publish(temporary, destination);
  } catch (error) {
    output.destroy();
    await fsp.unlink(temporary).catch(() => {});
    throw error;
  } finally { derived.fill(0); }
}

async function decrypt(source, destination, key) {
  const file = await fsp.open(source, 'r');
  let temporary, output, derived;
  try {
    const { size } = await file.stat();
    if (size < HEADER_SIZE + TAG_SIZE) throw new Error('Backup is truncated.');
    const header = Buffer.alloc(HEADER_SIZE), tag = Buffer.alloc(TAG_SIZE);
    await file.read(header, 0, header.length, 0);
    await file.read(tag, 0, tag.length, size - TAG_SIZE);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unsupported backup format.');
    derived = subkey(key, header);
    const decipher = crypto.createDecipheriv('aes-256-gcm', derived, header.subarray(HEADER_SIZE - 12));
    decipher.setAAD(header); decipher.setAuthTag(tag);
    if (destination) ({ temporary, output } = await privateTemp(destination));
    else output = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const input = size === HEADER_SIZE + TAG_SIZE ? require('node:stream').Readable.from([])
      : file.createReadStream({ start: HEADER_SIZE, end: size - TAG_SIZE - 1, autoClose: false });
    await pipeline(input, decipher, output);
    if (destination) await publish(temporary, destination);
    return { verified: true, bytes: size };
  } catch (error) {
    output?.destroy();
    if (temporary) await fsp.unlink(temporary).catch(() => {});
    throw error;
  } finally { derived?.fill(0); await file.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  const keyFile = args[0] === '--key-file' ? args.splice(0, 2)[1] : undefined;
  const [command, input, output] = args;
  if (!['key-init', 'encrypt', 'verify', 'decrypt'].includes(command)) throw new Error('Usage: secure-backup.cjs key-init | encrypt <input|-> <output> | verify <input> | decrypt <input> <private-output>');
  const key = readKey({ create: command === 'key-init', keyFile });
  try {
    if (command === 'key-init') console.log(`Backup key is present and verified in ${keyFile ? 'the private key file' : 'Mac Keychain'}.`);
    else if (!input || ((command === 'encrypt' || command === 'decrypt') && !output)) throw new Error('Input/output path is missing.');
    else if (command === 'encrypt') await encrypt(input === '-' ? process.stdin : fs.createReadStream(input), path.resolve(output), key);
    else await decrypt(path.resolve(input), command === 'decrypt' ? path.resolve(output) : null, key);
    if (command !== 'key-init') console.log('Backup operation completed; authenticated integrity verified on decrypt/verify.');
  } finally { key.fill(0); }
}

if (require.main === module) main().catch(() => { console.error('Backup operation failed. No existing backup or key was overwritten.'); process.exitCode = 1; });
module.exports = { encrypt, decrypt, readKey, HEADER_SIZE, TAG_SIZE };

const crypto = require('node:crypto');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const User = require('../models/User');
const MfaChallenge = require('../models/MfaChallenge');
const { readSessionToken, wantsBearerToken } = require('./sessionCookie');

const MFA_FIELDS = '+mfaSecretEncrypted +mfaPendingSecretEncrypted +mfaPendingExpiresAt +mfaLastUsedStep +mfaRecoveryCodeHashes';
const HASH = (value) => crypto.createHash('sha256').update(value).digest('hex');
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const sessionVersionMatch = (user) => (user.sessionVersion || 0) === 0 ? { $in: [0, null] } : user.sessionVersion;

const KEY_NAME = 'MFA_ENCRYPTION_KEY';

// Hosting dashboards and .env files often leave stray spaces, a newline or a pair of quotes
// around a pasted value; none of them change the key bytes, so they are ignored.
function configuredKey() {
  return String(process.env[KEY_NAME] ?? '').trim().replace(/^(["'])([\s\S]*)\1$/, '$2').trim();
}

// Says why the key is unusable without ever returning its value, so an owner can fix the
// hosting setting. Only the problem category, a length and variable *names* leave this module.
function keyReport() {
  const value = configuredKey();
  if (!value) {
    const similarNames = Object.keys(process.env)
      .filter((name) => name !== KEY_NAME && /mfa|encryption/i.test(name)).slice(0, 5).map((name) => name.slice(0, 80));
    return { problem: 'missing', similarNames };
  }
  if (!/^[a-f0-9]+$/i.test(value)) return { problem: 'not_hex', length: value.length };
  if (value.length !== 64) return { problem: 'length', length: value.length };
  return { problem: null };
}

function available() {
  return keyReport().problem === null;
}

function warnIfKeyUnusable(log = console.warn) {
  const { problem } = keyReport();
  if (problem) log(`⚠️  ${KEY_NAME} không dùng được (${problem}) — Google Authenticator tắt cho đến khi sửa biến này.`);
}

function key() {
  if (!available()) throw error('Chưa có khóa bảo mật 2FA trên máy chủ.', 503);
  return Buffer.from(configuredKey(), 'hex');
}

function encryptSecret(secret, userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`HDTLabx:mfa:v1:${userId}`));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(value, userId) {
  const [version, iv, tag, encrypted, extra] = String(value || '').split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted || extra) throw error('Không đọc được khóa 2FA.', 503);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(`HDTLabx:mfa:v1:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function totp(secret, email = '') {
  return new OTPAuth.TOTP({ issuer: 'HDTLabx', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret });
}

function verifiedStep(secret, code) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const now = Date.now();
  const delta = totp(secret).validate({ token: code, window: 1, timestamp: now });
  return delta === null ? null : Math.floor(now / 30000) + delta;
}

function recoveryHash(userId, code) {
  const normalized = typeof code === 'string' ? code.replace(/[\s-]/g, '').toUpperCase() : '';
  return /^[A-F0-9]{32}$/.test(normalized) ? HASH(`${userId}:${normalized}`) : '';
}

function recoveryCodes(userId) {
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g).join('-'));
  return { codes, hashes: codes.map((code) => recoveryHash(userId, code)) };
}

async function reserveAttempt(user) {
  const now = new Date();
  const filter = { _id: user._id, sessionVersion: sessionVersionMatch(user), status: 'active' };
  await User.updateOne({ ...filter, $or: [{ mfaAttemptExpiresAt: { $lte: now } }, { mfaAttemptExpiresAt: null }] }, {
    $set: { mfaAttempts: 0, mfaAttemptExpiresAt: new Date(now.getTime() + 15 * 60000) },
  });
  const result = await User.updateOne({ ...filter, mfaAttempts: { $lt: 10 }, mfaAttemptExpiresAt: { $gt: now } }, { $inc: { mfaAttempts: 1 } });
  if (result.modifiedCount !== 1) throw error('Thử xác thực quá nhiều. Vui lòng đợi 15 phút.', 429);
}

// The conditional update consumes an OTP time step or recovery code exactly once,
// including when different workers verify requests concurrently.
async function consumeFactor(user, code, update = {}) {
  key();
  await reserveAttempt(user);
  const filter = { _id: user._id, status: 'active', sessionVersion: sessionVersionMatch(user), mfaEnabled: true, mfaSecretEncrypted: user.mfaSecretEncrypted };
  const changes = { ...update, $set: { ...update.$set, mfaAttempts: 0 } };
  if (typeof code === 'string' && /^\d{6}$/.test(code)) {
    const step = verifiedStep(decryptSecret(user.mfaSecretEncrypted, user._id), code);
    if (step === null) throw error('Mã xác thực không đúng, đã hết hạn hoặc đã dùng.', 401);
    filter.$or = [{ mfaLastUsedStep: { $lt: step } }, { mfaLastUsedStep: null }];
    changes.$set.mfaLastUsedStep = step;
  } else {
    const hash = recoveryHash(user._id, code);
    if (!hash) throw error('Mã xác thực không đúng, đã hết hạn hoặc đã dùng.', 401);
    filter.mfaRecoveryCodeHashes = hash;
    if (!Object.hasOwn(changes.$set, 'mfaRecoveryCodeHashes')) changes.$pull = { mfaRecoveryCodeHashes: hash };
  }
  const result = await User.findOneAndUpdate(filter, changes, { new: true }).select(MFA_FIELDS);
  if (!result) throw error('Mã xác thực không đúng, đã hết hạn hoặc đã dùng.', 401);
  return result;
}

async function checkPassword(user, password) {
  if (typeof password !== 'string' || password.length > 1024 || !await user.matchPassword(password)) {
    throw error('Mật khẩu hiện tại không đúng.', 401);
  }
}

function csrfToken(req) {
  return crypto.createHmac('sha256', key()).update(`mfa-csrf:${req.userId}:${req.sessionVersion}:${readSessionToken(req)}`).digest('base64url');
}

function guardMfaRequest(req, res, next) {
  const origin = req.headers.origin;
  const bearer = String(req.headers.authorization || '').startsWith('Bearer ');
  if (!bearer && origin) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.host !== req.headers.host) throw new Error('origin');
    } catch {
      return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
    }
  }
  if (req.method === 'GET') return next();
  try {
    const expected = Buffer.from(csrfToken(req));
    const supplied = Buffer.from(String(req.headers['x-mfa-csrf'] || '').slice(0, 100));
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return res.status(403).json({ message: 'Phiên bảo mật đã thay đổi. Tải lại trang và thử lại.' });
    }
    return next();
  } catch (err) {
    return res.status(err.status || 503).json({ message: 'Chưa có khóa bảo mật 2FA trên máy chủ.' });
  }
}

async function beginSetup(user) {
  if (user.mfaEnabled) throw error('Tài khoản đã bật Google Authenticator.', 409);
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const encrypted = encryptSecret(secret, user._id);
  const expiresAt = new Date(Date.now() + 10 * 60000);
  const saved = await User.updateOne({ _id: user._id, sessionVersion: sessionVersionMatch(user), mfaEnabled: { $ne: true } }, {
    $set: { mfaPendingSecretEncrypted: encrypted, mfaPendingExpiresAt: expiresAt },
  });
  if (saved.modifiedCount !== 1) throw error('Phiên đã thay đổi. Đăng nhập lại.', 401);
  const uri = totp(secret, user.email).toString();
  const qrCode = await QRCode.toDataURL(uri, { width: 240, margin: 2, errorCorrectionLevel: 'M' });
  return { secret, qrCode, expiresAt };
}

async function enableMfa(user, code) {
  if (user.mfaEnabled) throw error('Tài khoản đã bật Google Authenticator.', 409);
  if (!user.mfaPendingExpiresAt || user.mfaPendingExpiresAt <= new Date()) throw error('QR đã hết hạn. Hãy tạo lại.', 400);
  await reserveAttempt(user);
  const secret = decryptSecret(user.mfaPendingSecretEncrypted, user._id);
  const step = verifiedStep(secret, code);
  if (step === null) throw error('Mã xác thực không đúng hoặc đã hết hạn.', 401);
  const recovery = recoveryCodes(user._id);
  const saved = await User.findOneAndUpdate({ _id: user._id, status: 'active', sessionVersion: sessionVersionMatch(user),
    mfaEnabled: { $ne: true }, mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted, mfaPendingExpiresAt: { $gt: new Date() } }, {
    $set: { mfaEnabled: true, mfaSecretEncrypted: user.mfaPendingSecretEncrypted, mfaLastUsedStep: step, mfaRecoveryCodeHashes: recovery.hashes, mfaAttempts: 0 },
    $unset: { mfaPendingSecretEncrypted: '', mfaPendingExpiresAt: '' }, $inc: { sessionVersion: 1 },
  }, { new: true });
  if (!saved) throw error('Phiên thiết lập đã thay đổi. Hãy tạo lại QR.', 409);
  return { user: saved, recoveryCodes: recovery.codes };
}

async function beginLogin(req, user) {
  key();
  const token = crypto.randomBytes(32).toString('base64url');
  await MfaChallenge.create({ tokenHash: HASH(token), userId: user._id, sessionVersion: user.sessionVersion || 0,
    mobile: wantsBearerToken(req) || String(req.headers.authorization || '').startsWith('Bearer '), expiresAt: new Date(Date.now() + 5 * 60000) });
  return { requiresMfa: true, challengeToken: token, expiresIn: 300 };
}

async function finishLogin(token, code) {
  if (typeof token !== 'string' || !/^[\w-]{43}$/.test(token) || typeof code !== 'string' || code.length > 100) throw error('Yêu cầu xác thực không hợp lệ.', 401);
  const challenge = await MfaChallenge.findOneAndUpdate({ tokenHash: HASH(token), expiresAt: { $gt: new Date() }, attemptsRemaining: { $gt: 0 } }, { $inc: { attemptsRemaining: -1 } }, { new: true });
  if (!challenge) throw error('Phiên xác thực hết hạn. Hãy đăng nhập lại.', 401);
  const user = await User.findById(challenge.userId).select(MFA_FIELDS);
  if (!user || user.status !== 'active' || !user.mfaEnabled || user.sessionVersion !== challenge.sessionVersion) throw error('Phiên xác thực hết hạn. Hãy đăng nhập lại.', 401);
  const verified = await consumeFactor(user, code);
  const used = await MfaChallenge.deleteOne({ _id: challenge._id });
  if (used.deletedCount !== 1) throw error('Phiên xác thực đã được sử dụng.', 401);
  return { user: verified, mobile: challenge.mobile };
}

module.exports = { MFA_FIELDS, available, keyReport, warnIfKeyUnusable, encryptSecret, decryptSecret, totp, verifiedStep, recoveryCodes, reserveAttempt,
  consumeFactor, checkPassword, csrfToken, guardMfaRequest, beginSetup, enableMfa, beginLogin, finishLogin };

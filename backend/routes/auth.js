const express = require('express');
const bcrypt = require('bcryptjs');
const { issueSession } = require('../lib/authSession');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const { isOwnerRole } = require('../config/users');
const { authWithUser, requireOwner } = require('../middleware/authz');
const mfa = require('../lib/mfa');
const AdminSession = require('../models/AdminSession');
const SecurityEvent = require('../models/SecurityEvent');
const sessions = require('../lib/adminSessions');
const { csrfToken } = require('../middleware/csrf');
const { authAudit } = require('../middleware/authAudit');
const mongoose = require('mongoose');

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: isOwnerRole(user.role) ? 'owner' : 'staff',
  phone: user.phone || '',
  status: user.status,
  mfaEnabled: Boolean(user.mfaEnabled),
});

const { verifyToken } = require('../middleware/verifyToken');
const { rateLimit } = require('../middleware/rateLimit');
const loginThrottle = require('../lib/loginThrottle');
const alerts = require('../lib/securityAlerts');
const { noStore } = require('../middleware/security');
const {
  clearSessionCookie,
} = require('../lib/sessionCookie');

router.use(noStore);
router.use(authAudit);

/** Đăng ký công khai đã tắt — tạo nhân viên qua POST /api/users (chủ hệ thống). */
router.post('/register', (_req, res) => {
  res.status(403).json({
    message: 'Không cho đăng ký công khai. Chủ hệ thống tạo tài khoản nhân viên trong mục Hồ sơ.',
  });
});

router.get('/me', ...authWithUser, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.get('/csrf', verifyToken, (req, res) => res.json({ csrfToken: csrfToken(req) }));

router.get('/sessions', ...authWithUser, requireOwner, async (req, res) => {
  try {
    const records = await AdminSession.find(sessions.activeFilter(req.userId, req.sessionVersion)).sort({ lastSeenAt: -1 }).limit(100);
    res.json({ policy: { idleMinutes: sessions.IDLE_MS / 60000, maxHours: sessions.MAX_MS / 3600000 },
      sessions: records.map((record) => ({ id: String(record._id), current: String(record._id) === String(req.adminSession?._id),
        browser: record.browser, platform: record.platform, createdAt: record.createdAt, lastSeenAt: record.lastSeenAt, expiresAt: record.expiresAt })) });
  } catch { res.status(503).json({ message: 'Không đọc được danh sách phiên.' }); }
});

router.delete('/sessions/:id', ...authWithUser, requireOwner, async (req, res) => {
  try {
    const others = req.params.id === 'others';
    if (!others && !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Phiên không hợp lệ.' });
    const filter = { userId: req.userId, revokedAt: null, ...(others
      ? { ...(req.adminSession ? { _id: { $ne: req.adminSession._id } } : {}) }
      : { _id: req.params.id }) };
    const result = await AdminSession.updateMany(filter, { $set: { revokedAt: new Date() } });
    const current = !others && String(req.adminSession?._id) === req.params.id;
    if (current) clearSessionCookie(res);
    res.json({ revoked: result.modifiedCount, current });
  } catch { res.status(503).json({ message: 'Không thu hồi được phiên.' }); }
});

router.get('/security-events', ...authWithUser, requireOwner, async (_req, res) => {
  try {
    const events = await SecurityEvent.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(50).select('event outcome createdAt').lean();
    res.json({ events });
  } catch { res.status(503).json({ message: 'Không đọc được nhật ký bảo mật.' }); }
});

router.patch(
  '/profile',
  ...authWithUser,
  [
    body('name').optional().notEmpty().withMessage('Tên không được trống'),
    body('email').optional().isEmail(),
    body('password').optional().isString().isLength({ min: 8 }).custom((value) => Buffer.byteLength(value) <= 72),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;
      let user = await User.findById(req.userId).select(mfa.MFA_FIELDS);
      if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

      const owner = isOwnerRole(user.role);
      const previousEmail = user.email;
      const alertChanges = () => {
        if (password) alerts.notify('password', [user.email], req);
        if (emailChanged) alerts.notify('email', [previousEmail, nextEmail], req);
      };
      const nextEmail = email?.toLowerCase();
      const emailChanged = nextEmail && nextEmail !== user.email;
      if (emailChanged) {
        if (!owner) return res.status(403).json({ message: 'Chỉ chủ hệ thống được đổi email đăng nhập' });
        const taken = await User.findOne({ email: nextEmail });
        if (taken && String(taken._id) !== String(user._id)) return res.status(400).json({ message: 'Email đã được dùng' });
      }

      if (user.mfaEnabled && (password || emailChanged)) {
        let allowed = false;
        mfa.guardMfaRequest(req, res, () => { allowed = true; });
        if (!allowed) return;
        try {
          await mfa.checkPassword(user, req.body.currentPassword);
          // Change credentials and revoke sessions in the same conditional update
          // that consumes the factor, so concurrent changes cannot restore an old version.
          user = await mfa.consumeFactor(user, req.body.code, {
            $set: { ...(name ? { name: name.trim() } : {}), ...(emailChanged ? { email: nextEmail } : {}),
              ...(password ? { password: await bcrypt.hash(password, 10) } : {}) },
            $inc: { sessionVersion: 1 },
          });
          alertChanges();
          return res.json({ message: 'Đã cập nhật hồ sơ', user: publicUser(user), ...(await issueSession(req, res, user)) });
        } catch (err) {
          return res.status(err.status === 401 ? 400 : err.status || 503).json({ message: err.status ? err.message : 'Không xác thực được thay đổi.' });
        }
      }

      if (name) user.name = name.trim();
      if (password) user.password = password;

      if (emailChanged) user.email = nextEmail;

      await user.save();
      alertChanges();
      const refreshed = password ? await issueSession(req, res, user) : {};
      res.json({ message: 'Đã cập nhật hồ sơ', user: publicUser(user), ...refreshed });
    } catch (_error) {
      res.status(500).json({ message: 'Lỗi cập nhật hồ sơ' });
    }
  }
);

const LOGIN_FAIL = 'Email hoặc mật khẩu không đúng';

router.post(
  '/login',
  rateLimit({
    max: 10,
    windowMs: 15 * 60 * 1000,
    bucket: 'login',
    message: 'Thử đăng nhập quá nhiều. Đợi 15 phút rồi thử lại.',
  }),
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: LOGIN_FAIL });
      }

      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'Máy chủ chưa cấu hình xác thực' });
      }

      const email = String(req.body.email || '').trim().toLowerCase();
      const { password } = req.body;
      const budget = await loginThrottle.reserveLogin(req, email);
      if (!budget.allowed) {
        res.setHeader('Retry-After', String(loginThrottle.WINDOW_MS / 1000));
        return res.status(429).json({ message: 'Thử đăng nhập quá nhiều. Đợi 15 phút rồi thử lại.' });
      }
      const user = await User.findOne({ email });
      if (user) req.auditUserId = user._id;

      if (!user || user.status !== 'active') {
        return res.status(401).json({ message: LOGIN_FAIL });
      }

      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: LOGIN_FAIL });
      }
      await loginThrottle.clearAccount(budget.account);

      const role = isOwnerRole(user.role) ? 'owner' : 'staff';
      if (user.mfaEnabled) {
        req.mfaChallengeIssued = true;
        return res.json(await mfa.beginLogin(req, user));
      }
      const newDevice = await alerts.isNewDevice(user._id, req.auditDevice = alerts.deviceHash(req));
      const session = await issueSession(req, res, user);
      if (newDevice) alerts.notify('new_device', [user.email], req);
      const payload = {
        message: 'Login successful',
        user: publicUser(user),
        isOwner: role === 'owner',
        cookieSession: true,
      };
      Object.assign(payload, session);
      res.json(payload);
    } catch (_error) {
      res.status(500).json({ message: 'Không đăng nhập được' });
    }
  }
);

router.post('/mfa/login', rateLimit({ max: 20, windowMs: 15 * 60000, bucket: 'mfa-login' }), async (req, res) => {
  try {
    const verified = await mfa.finishLogin(req.body.challengeToken, req.body.code);
    req.auditUserId = verified.user._id;
    req.body.client = verified.mobile ? 'mobile' : 'web';
    const newDevice = await alerts.isNewDevice(verified.user._id, req.auditDevice = alerts.deviceHash(req));
    const session = await issueSession(req, res, verified.user, { mfaVerified: true });
    if (newDevice) alerts.notify('new_device', [verified.user.email], req);
    res.json({ user: publicUser(verified.user), isOwner: isOwnerRole(verified.user.role), cookieSession: true, ...session });
  } catch (err) {
    res.status(err.status || 503).json({ message: err.status ? err.message : 'Không xác thực được mã. Vui lòng thử lại.' });
  }
});

const management = express.Router();
management.use(...authWithUser, requireOwner, mfa.guardMfaRequest);
management.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(mfa.MFA_FIELDS);
    const keyReport = mfa.keyReport();
    res.json({ enabled: Boolean(user.mfaEnabled), available: keyReport.problem === null,
      ...(keyReport.problem ? { keyProblem: keyReport.problem, keyLength: keyReport.length, keyNames: keyReport.similarNames } : {}),
      recoveryCodesRemaining: user.mfaRecoveryCodeHashes?.length || 0,
      csrfToken: keyReport.problem === null ? mfa.csrfToken(req) : '' });
  } catch (_err) {
    res.status(503).json({ message: 'Không đọc được trạng thái bảo mật.' });
  }
});
management.use(rateLimit({ max: 15, windowMs: 15 * 60000, bucket: 'mfa-settings' }));
function mfaAction(handler) {
  return async (req, res) => {
    try {
      const user = await User.findById(req.userId).select(mfa.MFA_FIELDS);
      await handler(req, res, user);
    } catch (err) {
      res.status(err.status === 401 ? 400 : err.status || 503).json({ message: err.status ? err.message : 'Không cập nhật được Google Authenticator.' });
    }
  };
}
management.post('/setup', mfaAction(async (req, res, user) => {
  await mfa.checkPassword(user, req.body.currentPassword);
  res.json(await mfa.beginSetup(user));
}));
management.post('/enable', mfaAction(async (req, res, user) => {
  const enabled = await mfa.enableMfa(user, req.body.code);
  const session = await issueSession(req, res, enabled.user, { mfaVerified: true });
  alerts.notify('mfa_enable', [enabled.user.email], req);
  res.json({ user: publicUser(enabled.user), recoveryCodes: enabled.recoveryCodes, ...session });
}));
management.post('/recovery-codes', mfaAction(async (req, res, user) => {
  if (!user.mfaEnabled) return res.status(409).json({ message: 'Tài khoản chưa bật Google Authenticator.' });
  await mfa.checkPassword(user, req.body.currentPassword);
  const recovery = mfa.recoveryCodes(user._id);
  const updated = await mfa.consumeFactor(user, req.body.code, { $set: { mfaRecoveryCodeHashes: recovery.hashes }, $inc: { sessionVersion: 1 } });
  const session = await issueSession(req, res, updated, { mfaVerified: true });
  alerts.notify('mfa_recovery', [updated.email], req);
  res.json({ user: publicUser(updated), recoveryCodes: recovery.codes, ...session });
}));
management.post('/disable', mfaAction(async (req, res, user) => {
  if (!user.mfaEnabled) return res.status(409).json({ message: 'Tài khoản chưa bật Google Authenticator.' });
  await mfa.checkPassword(user, req.body.currentPassword);
  const updated = await mfa.consumeFactor(user, req.body.code, {
    $set: { mfaEnabled: false, mfaRecoveryCodeHashes: [] }, $inc: { sessionVersion: 1 },
    $unset: { mfaSecretEncrypted: '', mfaPendingSecretEncrypted: '', mfaPendingExpiresAt: '' },
  });
  const session = await issueSession(req, res, updated, { mfaVerified: false });
  alerts.notify('mfa_disable', [updated.email], req);
  res.json({ user: publicUser(updated), ...session });
}));
router.use('/mfa', management);

router.post('/logout', verifyToken, async (req, res) => {
  try {
    if (req.adminSession) await AdminSession.updateOne({ _id: req.adminSession._id, userId: req.userId }, { $set: { revokedAt: new Date() } });
    else await User.updateOne({ _id: req.userId }, { $inc: { sessionVersion: 1 } });
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (_error) {
    res.status(500).json({ message: 'Không đăng xuất được' });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken; // tương thích routes cũ

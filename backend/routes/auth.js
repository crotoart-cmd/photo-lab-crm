const express = require('express');
const bcrypt = require('bcryptjs');
const { issueSession } = require('../lib/authSession');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const { isOwnerRole } = require('../config/users');
const { authWithUser, requireOwner } = require('../middleware/authz');
const mfa = require('../lib/mfa');

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
const { noStore } = require('../middleware/security');
const {
  clearSessionCookie,
} = require('../lib/sessionCookie');

router.use(noStore);

/** Đăng ký công khai đã tắt — tạo nhân viên qua POST /api/users (chủ hệ thống). */
router.post('/register', (_req, res) => {
  res.status(403).json({
    message: 'Không cho đăng ký công khai. Chủ hệ thống tạo tài khoản nhân viên trong mục Hồ sơ.',
  });
});

router.get('/me', ...authWithUser, async (req, res) => {
  res.json({ user: publicUser(req.user) });
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
          return res.json({ message: 'Đã cập nhật hồ sơ', user: publicUser(user), ...issueSession(req, res, user) });
        } catch (err) {
          return res.status(err.status === 401 ? 400 : err.status || 503).json({ message: err.status ? err.message : 'Không xác thực được thay đổi.' });
        }
      }

      if (name) user.name = name.trim();
      if (password) user.password = password;

      if (emailChanged) user.email = nextEmail;

      await user.save();
      const refreshed = password ? issueSession(req, res, user) : {};
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
      const user = await User.findOne({ email });

      if (!user || user.status !== 'active') {
        return res.status(401).json({ message: LOGIN_FAIL });
      }

      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: LOGIN_FAIL });
      }

      const role = isOwnerRole(user.role) ? 'owner' : 'staff';
      if (user.mfaEnabled) return res.json(await mfa.beginLogin(req, user));
      const session = issueSession(req, res, user);
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
    req.body.client = verified.mobile ? 'mobile' : 'web';
    const session = issueSession(req, res, verified.user, { mfaVerified: true });
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
    res.json({ enabled: Boolean(user.mfaEnabled), available: mfa.available(),
      recoveryCodesRemaining: user.mfaRecoveryCodeHashes?.length || 0,
      csrfToken: mfa.available() ? mfa.csrfToken(req) : '' });
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
  const session = issueSession(req, res, enabled.user, { mfaVerified: true });
  res.json({ user: publicUser(enabled.user), recoveryCodes: enabled.recoveryCodes, ...session });
}));
management.post('/recovery-codes', mfaAction(async (req, res, user) => {
  if (!user.mfaEnabled) return res.status(409).json({ message: 'Tài khoản chưa bật Google Authenticator.' });
  await mfa.checkPassword(user, req.body.currentPassword);
  const recovery = mfa.recoveryCodes(user._id);
  const updated = await mfa.consumeFactor(user, req.body.code, { $set: { mfaRecoveryCodeHashes: recovery.hashes }, $inc: { sessionVersion: 1 } });
  const session = issueSession(req, res, updated, { mfaVerified: true });
  res.json({ user: publicUser(updated), recoveryCodes: recovery.codes, ...session });
}));
management.post('/disable', mfaAction(async (req, res, user) => {
  if (!user.mfaEnabled) return res.status(409).json({ message: 'Tài khoản chưa bật Google Authenticator.' });
  await mfa.checkPassword(user, req.body.currentPassword);
  const updated = await mfa.consumeFactor(user, req.body.code, {
    $set: { mfaEnabled: false, mfaRecoveryCodeHashes: [] }, $inc: { sessionVersion: 1 },
    $unset: { mfaSecretEncrypted: '', mfaPendingSecretEncrypted: '', mfaPendingExpiresAt: '' },
  });
  const session = issueSession(req, res, updated, { mfaVerified: false });
  res.json({ user: publicUser(updated), ...session });
}));
router.use('/mfa', management);

router.post('/logout', verifyToken, async (req, res) => {
  try {
    await User.updateOne({ _id: req.userId }, { $inc: { sessionVersion: 1 } });
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (_error) {
    res.status(500).json({ message: 'Không đăng xuất được' });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken; // tương thích routes cũ

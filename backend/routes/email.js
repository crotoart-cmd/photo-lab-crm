const express = require('express');
const EmailLog = require('../models/EmailLog');
const { verifyToken } = require('./auth');
const { authWithUser, requireOwner } = require('../middleware/authz');
const { isEmailConfigured, verifySmtp, normalizeAppPassword, isTestRedirectActive } = require('../services/emailService');
const { getDriveStatus } = require('../services/googleDriveService');
const { rateLimit } = require('../middleware/rateLimit');
const { isValidEmail } = require('../lib/httpSafety');

const router = express.Router();

router.get('/status', ...authWithUser, requireOwner, (req, res) => {
  const passLen = normalizeAppPassword(process.env.EMAIL_PASSWORD).length;
  const user = process.env.EMAIL_USER || '';
  res.json({
    configured: isEmailConfigured(),
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    userConfigured: Boolean(user),
    appPasswordValid: passLen === 16,
    googleDrive: getDriveStatus(),
    testRedirectActive: isTestRedirectActive(),
  });
});

router.post('/verify', ...authWithUser, requireOwner, async (_req, res) => {
  const result = await verifySmtp();
  res.status(result.ok ? 200 : 400).json(result);
});

/** Gửi HTML tùy ý từ thiết bị (Y700) qua HTTPS — khi SMTP native bị mạng chặn. */
router.post(
  '/device-send',
  verifyToken,
  rateLimit({
    max: 10,
    windowMs: 60 * 60 * 1000,
    bucket: 'device-send',
    message: 'Gửi email quá nhiều. Thử lại sau.',
  }),
  async (req, res) => {
    try {
      const to = String(req.body?.to || '').trim();
      const subject = String(req.body?.subject || '').trim().slice(0, 200);
      const html = String(req.body?.html || '');
      if (!isValidEmail(to) || !subject || !html) {
        return res.status(400).json({ sent: false, error: 'Thiếu to / subject / html hợp lệ' });
      }
      if (html.length > 100 * 1024) {
        return res.status(413).json({ sent: false, error: 'Nội dung email quá lớn' });
      }
      const { sendMail } = require('../services/emailService');
      const result = await sendMail({
        to,
        subject,
        html,
        emailType: 'device_test',
      });
      res.status(result.sent ? 200 : 400).json({ sent: result.sent, error: result.sent ? undefined : 'Không gửi được email' });
    } catch (_error) {
      res.status(500).json({ sent: false, error: 'Không gửi được email' });
    }
  }
);

router.get('/logs', ...authWithUser, requireOwner, async (req, res) => {
  try {
    const { filmId } = req.query;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
    const filter = filmId ? { filmId } : {};
    const logs = await EmailLog.find(filter)
      .populate('filmId', 'filmCode')
      .populate('customerId', 'firstName lastName email')
      .sort({ sentAt: -1 })
      .limit(limit);

    res.json(logs);
  } catch (_error) {
    res.status(500).json({ message: 'Không tải được nhật ký email' });
  }
});

module.exports = router;

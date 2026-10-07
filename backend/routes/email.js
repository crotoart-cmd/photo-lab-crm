const express = require('express');
const EmailLog = require('../models/EmailLog');
const { verifyToken } = require('./auth');
const { isEmailConfigured, verifySmtp, normalizeAppPassword, isTestRedirectActive } = require('../services/emailService');
const { getDriveStatus } = require('../services/googleDriveService');

const router = express.Router();

router.get('/status', verifyToken, (req, res) => {
  const passLen = normalizeAppPassword(process.env.EMAIL_PASSWORD).length;
  res.json({
    configured: isEmailConfigured(),
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    user: process.env.EMAIL_USER || null,
    appPasswordLength: passLen,
    appPasswordValid: passLen === 16,
    googleDrive: getDriveStatus(),
    testEmailTo: process.env.TEST_EMAIL_TO || null,
    testRedirectActive: isTestRedirectActive(),
  });
});

router.post('/verify', verifyToken, async (_req, res) => {
  const result = await verifySmtp();
  res.status(result.ok ? 200 : 400).json(result);
});

/** Gửi HTML tùy ý từ thiết bị (Y700) qua HTTPS — khi SMTP native bị mạng chặn. */
router.post('/device-send', verifyToken, async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const html = String(req.body?.html || '');
    if (!to || !subject || !html) {
      return res.status(400).json({ sent: false, error: 'Thiếu to / subject / html' });
    }
    const { sendMail } = require('../services/emailService');
    const result = await sendMail({
      to,
      subject,
      html,
      emailType: 'device_test',
    });
    res.status(result.sent ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ sent: false, error: error.message });
  }
});

router.get('/logs', verifyToken, async (req, res) => {
  try {
    const { filmId, limit = 50 } = req.query;
    const filter = filmId ? { filmId } : {};
    const logs = await EmailLog.find(filter)
      .populate('filmId', 'filmCode')
      .populate('customerId', 'firstName lastName email')
      .sort({ sentAt: -1 })
      .limit(Number(limit));

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching email logs', error: error.message });
  }
});

module.exports = router;

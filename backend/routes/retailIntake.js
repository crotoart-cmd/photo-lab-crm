const express = require('express');
const { verifyToken } = require('./auth');
const {
  scanBarcode,
  identifyVision,
  confirmIntake,
} = require('../services/retailIntakeService');

const router = express.Router();

router.post('/scan', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ message: 'Thiếu mã barcode / QR' });
    }
    const detected = await scanBarcode(String(code).trim());
    res.json({ detected, ai_mode: detected.source });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi quét mã', error: error.message });
  }
});

router.post('/vision', verifyToken, async (req, res) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      return res.status(400).json({ message: 'Thiếu ảnh (image_base64)' });
    }
    const detected = await identifyVision(image_base64);
    res.json({
      detected,
      ai_mode: detected.source,
      openai_configured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi AI Vision', error: error.message });
  }
});

router.post('/confirm', verifyToken, async (req, res) => {
  try {
    const result = await confirmIntake(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Lỗi lưu nhập kho' });
  }
});

module.exports = router;

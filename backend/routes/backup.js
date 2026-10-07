const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/verifyToken');

const router = express.Router();
const backupDir = path.join(__dirname, '..', 'backups');

function safeFileName(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

router.post('/mobile', verifyToken, async (req, res) => {
  try {
    const reason = req.body?.reason || 'manual';
    const payload = req.body?.payload;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ message: 'Thiếu dữ liệu backup' });
    }

    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const user = safeFileName(req.userId);
    const id = `${stamp}_${user}`;
    const filePath = path.join(backupDir, `mobile_${id}.json`);

    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          backupId: id,
          createdAt: new Date().toISOString(),
          userId: req.userId,
          reason,
          payload,
        },
        null,
        2
      ),
      'utf8'
    );

    res.json({
      message: 'Đã backup lên server',
      backup: {
        id,
        reason,
        file: path.basename(filePath),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Backup thất bại', error: error.message });
  }
});

module.exports = router;

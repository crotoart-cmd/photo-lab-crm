const express = require('express');
const Film = require('../models/Film');
const { getFilePublicUrl, getPublicGalleryUrl, BRAND_NAME } = require('../services/deliveryFolderService');

const router = express.Router();

/** Gallery công khai cho khách — không cần đăng nhập */
router.get('/:slug', async (req, res) => {
  try {
    const film = await Film.findOne({ deliverySlug: String(req.params.slug).toUpperCase() });
    if (!film) {
      return res.status(404).json({ message: 'Không tìm thấy thư mục ảnh' });
    }
    if (!['completed', 'delivered'].includes(film.status)) {
      return res.status(403).json({ message: 'Thư mục chưa sẵn sàng' });
    }

    const files = (film.deliveryFiles || []).map((f) => ({
      filename: f.filename,
      name: f.originalName,
      size: f.size,
      url: getFilePublicUrl(film.deliverySlug, f.filename),
      uploadedAt: f.uploadedAt,
    }));

    res.json({
      brand: BRAND_NAME,
      ticketNumber: film.ticketNumber || film.filmCode,
      galleryUrl: getPublicGalleryUrl(film.deliverySlug),
      fileCount: files.length,
      files,
      linkSentAt: film.completionEmailSentAt,
      driveWebViewLink: film.driveWebViewLink || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải gallery', error: error.message });
  }
});

module.exports = router;

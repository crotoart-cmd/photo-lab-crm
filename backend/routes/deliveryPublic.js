const express = require('express');
const {
  getFilePublicUrl,
  getPublicGalleryUrl,
  findFilmByDeliveryToken,
  resolveDeliveryFilePath,
  BRAND_NAME,
} = require('../services/deliveryFolderService');
const { rateLimit } = require('../middleware/rateLimit');
const { noStore } = require('../middleware/security');
const { DELIVERY_TYPES, uploadResponseHeaders } = require('../lib/uploads');

const router = express.Router();

router.use(noStore);
router.use(
  rateLimit({
    max: 60,
    windowMs: 60 * 60 * 1000,
    bucket: 'delivery-public',
    message: 'Quá nhiều yêu cầu. Thử lại sau.',
  })
);

async function loadReadyFilm(token) {
  const film = await findFilmByDeliveryToken(token);
  if (!film) return null;
  if (!['completed', 'delivered'].includes(film.status)) return null;
  return film;
}

router.get('/:token/file/:filename', async (req, res) => {
  try {
    const film = await loadReadyFilm(req.params.token);
    if (!film) return res.status(404).end();
    const filePath = resolveDeliveryFilePath(film, req.params.filename);
    if (!filePath) return res.status(404).end();
    if (!uploadResponseHeaders(res, filePath, DELIVERY_TYPES)) return res.status(404).end();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.sendFile(filePath);
  } catch (_error) {
    return res.status(404).end();
  }
});

router.get('/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const film = await loadReadyFilm(token);
    if (!film) {
      return res.status(404).json({ message: 'Không tìm thấy thư mục ảnh' });
    }

    const files = (film.deliveryFiles || []).map((f) => ({
      filename: f.filename,
      name: f.originalName,
      size: f.size,
      url: getFilePublicUrl(token, f.filename),
      uploadedAt: f.uploadedAt,
    }));

    res.json({
      brand: BRAND_NAME,
      ticketNumber: film.ticketNumber || film.filmCode,
      galleryUrl: getPublicGalleryUrl(token),
      fileCount: files.length,
      files,
    });
  } catch (_error) {
    res.status(500).json({ message: 'Không tải được gallery' });
  }
});

module.exports = router;

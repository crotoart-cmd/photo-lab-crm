const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BRAND_NAME, getFrontendUrl, PRODUCTION_SITE_URL } = require('../config/brand');

const UPLOAD_ROOT = path.join(__dirname, '../uploads/delivery');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const sanitizeFilename = (name) =>
  String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);

const generateDeliverySlug = (film) => {
  const code = String(film.ticketNumber || film.filmCode || 'FM')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 12);
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${code}-${suffix}`.toUpperCase();
};

const getDeliveryDir = (slug) => {
  const dir = path.join(UPLOAD_ROOT, slug);
  ensureDir(dir);
  return dir;
};

const getPublicGalleryUrl = (slug) => {
  return `${getFrontendUrl()}/delivery/${slug}`;
};

const getFilePublicUrl = (slug, filename) => {
  const apiBase = (
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : `http://localhost:${process.env.PORT || 5001}`)
  ).replace(/\/$/, '');
  return `${apiBase}/uploads/delivery/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`;
};

const ensureDeliveryFolder = (film) => {
  if (!film.deliverySlug) {
    film.deliverySlug = generateDeliverySlug(film);
  }
  if (!film.deliveryFiles) film.deliveryFiles = [];
  getDeliveryDir(film.deliverySlug);
  return film.deliverySlug;
};

const addUploadedFiles = (film, uploaded) => {
  for (const f of uploaded) {
    film.deliveryFiles.push({
      filename: f.filename,
      originalName: f.originalName,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: new Date(),
    });
  }
};

module.exports = {
  UPLOAD_ROOT,
  ensureDeliveryFolder,
  addUploadedFiles,
  getDeliveryDir,
  getPublicGalleryUrl,
  getFilePublicUrl,
  sanitizeFilename,
  BRAND_NAME,
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BRAND_NAME, getFrontendUrl, PRODUCTION_SITE_URL } = require('../config/brand');
const { issueConfirmToken, hashConfirmToken, isPlausibleConfirmToken } = require('../lib/confirmToken');

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
  const suffix = crypto.randomBytes(8).toString('hex');
  return `${code}-${suffix}`.toUpperCase();
};

function assertSafeDeliverySlug(slug) {
  const s = String(slug || '').toUpperCase();
  if (!/^[A-Z0-9-]{8,48}$/.test(s)) {
    const err = new Error('Slug không hợp lệ');
    err.status = 400;
    throw err;
  }
  return s;
}

const getDeliveryDir = (slug) => {
  const safe = assertSafeDeliverySlug(slug);
  const dir = path.join(UPLOAD_ROOT, safe);
  const resolved = path.resolve(dir);
  const root = path.resolve(UPLOAD_ROOT);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    const err = new Error('Slug không hợp lệ');
    err.status = 400;
    throw err;
  }
  ensureDir(resolved);
  return resolved;
};

function apiPublicBase() {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : `http://localhost:${process.env.PORT || 5001}`)
  ).replace(/\/$/, '');
}

const getPublicGalleryUrl = (accessToken) => {
  return `${getFrontendUrl()}/delivery/${accessToken}`;
};

const getFilePublicUrl = (accessToken, filename) => {
  return `${apiPublicBase()}/api/delivery/${encodeURIComponent(accessToken)}/file/${encodeURIComponent(filename)}`;
};

function issueDeliveryAccess(film) {
  const { raw, hash } = issueConfirmToken();
  film.delivery_token_hash = hash;
  return { raw, url: getPublicGalleryUrl(raw) };
}

async function findFilmByDeliveryToken(rawToken) {
  if (!isPlausibleConfirmToken(rawToken)) return null;
  const Film = require('../models/Film');
  return Film.findOne({ delivery_token_hash: hashConfirmToken(String(rawToken).trim()) });
}

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

function resolveDeliveryFilePath(film, filename) {
  const safeName = sanitizeFilename(filename);
  const allowed = (film.deliveryFiles || []).some((f) => f.filename === safeName || f.filename === filename);
  if (!allowed) return null;
  const dir = getDeliveryDir(film.deliverySlug);
  const full = path.resolve(dir, safeName);
  if (!full.startsWith(`${dir}${path.sep}`) && full !== dir) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

module.exports = {
  UPLOAD_ROOT,
  ensureDeliveryFolder,
  addUploadedFiles,
  getDeliveryDir,
  getPublicGalleryUrl,
  getFilePublicUrl,
  sanitizeFilename,
  issueDeliveryAccess,
  findFilmByDeliveryToken,
  resolveDeliveryFilePath,
  BRAND_NAME,
};

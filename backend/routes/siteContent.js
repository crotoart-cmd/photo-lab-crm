const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { IMAGE_TYPES, uploadFilename, uploadFilter, secureUpload } = require('../lib/uploads');
const { publicError } = require('../lib/httpSafety');
const { verifyToken } = require('../middleware/verifyToken');
const { authWithUser, isOwnerRole } = require('../middleware/authz');
const SiteContent = require('../models/SiteContent');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../uploads/site');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      cb(null, uploadFilename(file));
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 20, parts: 21, fieldSize: 64 * 1024, fieldNameSize: 100, fieldArrayIndexLimit: 20 },
  fileFilter: uploadFilter(IMAGE_TYPES),
});

function publicDto(doc) {
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(row._id),
    type: row.type,
    title: row.title,
    slug: row.slug || '',
    kind: row.kind || '',
    author: row.author || '',
    excerpt: row.excerpt || '',
    body: row.body || '',
    image: row.image || '',
    images: Array.isArray(row.images) ? row.images.filter(Boolean).slice(0, 9) : [],
    price: Number(row.price) || 0,
    quantity: Number(row.quantity) || 0,
    published: !!row.published,
    sort: row.sort || 0,
    date: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function splitPublished(rows) {
  const items = rows.map(publicDto);
  return {
    blog: items.filter((i) => i.type === 'blog'),
    accessories: items.filter((i) => i.type === 'accessory'),
  };
}

router.get('/public', async (_req, res) => {
  try {
    const rows = await SiteContent.find({ published: true }).sort({ sort: 1, createdAt: -1 });
    res.json(splitPublished(rows));
  } catch (err) {
    res.status(500).json({ message: 'Không tải được nội dung' });
  }
});

router.get('/', ...authWithUser, async (req, res) => {
  try {
    const filter = isOwnerRole(req.userRole) ? {} : { type: { $ne: 'blog' } };
    const rows = await SiteContent.find(filter).sort({ type: 1, sort: 1, createdAt: -1 });
    res.json(rows.map(publicDto));
  } catch (err) {
    res.status(500).json({ message: 'Không tải được nội dung' });
  }
});

function slugify(text) {
  return (
    String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'post'
  );
}

function readFields(body) {
  const type = body.type === undefined ? 'blog' : body.type;
  if (!['accessory', 'blog'].includes(type)) {
    const error = new Error('Loại nội dung không hợp lệ');
    error.status = 400;
    throw error;
  }
  const publishedRaw = body.published;
  const unpublished = publishedRaw === false || publishedRaw === 'false' || publishedRaw === '0';
  const title = String(body.title || '').trim();
  const slug = String(body.slug || '').trim() || slugify(title);
  return {
    type,
    title,
    slug,
    kind: String(body.kind || '').trim(),
    author: String(body.author || '').trim(),
    excerpt: String(body.excerpt || '').trim(),
    body: String(body.body || '').trim(),
    published: !unpublished,
    sort: Number(body.sort) || 0,
    price: Math.max(0, Number(body.price) || 0),
    quantity: Math.max(0, Number(body.quantity) || 0),
    receivedQty: Math.max(0, Number(body.receivedQty != null ? body.receivedQty : body.quantity) || 0),
  };
}

router.post('/', ...authWithUser, secureUpload(upload.single('image'), IMAGE_TYPES), async (req, res) => {
  try {
    const fields = readFields(req.body || {});
    if (fields.type === 'blog' && !isOwnerRole(req.userRole)) {
      return res.status(403).json({ message: 'Chỉ chủ hệ thống được đăng blog' });
    }
    if (!fields.title) return res.status(400).json({ message: 'Cần tiêu đề' });
    if (req.file) fields.image = `/uploads/site/${req.file.filename}`;
    const doc = await SiteContent.create(fields);
    res.status(201).json(publicDto(doc));
  } catch (err) {
    publicError(res, err, 'Không tạo được nội dung');
  }
});

router.patch('/:id', ...authWithUser, secureUpload(upload.single('image'), IMAGE_TYPES), async (req, res) => {
  try {
    const doc = await SiteContent.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy' });
    const fields = readFields({ ...doc.toObject(), ...req.body });
    if ((doc.type === 'blog' || fields.type === 'blog') && !isOwnerRole(req.userRole)) {
      return res.status(403).json({ message: 'Chỉ chủ hệ thống được sửa blog' });
    }
    if (req.file) fields.image = `/uploads/site/${req.file.filename}`;
    Object.assign(doc, fields);
    await doc.save();
    res.json(publicDto(doc));
  } catch (err) {
    publicError(res, err, 'Không cập nhật được nội dung');
  }
});

router.delete('/:id', ...authWithUser, async (req, res) => {
  try {
    const existing = await SiteContent.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy' });
    if (existing.type === 'blog' && !isOwnerRole(req.userRole)) {
      return res.status(403).json({ message: 'Chỉ chủ hệ thống được xóa blog' });
    }
    const doc = await SiteContent.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ ok: true });
  } catch (err) {
    publicError(res, err, 'Không xóa được nội dung');
  }
});

module.exports = router;

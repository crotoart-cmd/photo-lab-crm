const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const IMAGE_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
};
const DELIVERY_TYPES = {
  ...IMAGE_TYPES, '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf',
};

function uploadFilename(file) {
  return `${crypto.randomBytes(18).toString('hex')}${path.extname(file.originalname || '').toLowerCase()}`;
}

function uploadFilter(types) {
  return (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const expected = types[ext];
    const heifMime = ['.heic', '.heif'].includes(ext) && ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(file.mimetype);
    if (!expected || (!heifMime && ![expected, 'application/octet-stream'].includes(file.mimetype))) {
      const error = new Error('Định dạng file không được hỗ trợ');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  };
}

function requestFiles(req) {
  return req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
}

async function removeUploads(files) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
}

function secureUpload(middleware, types, maxTotalBytes) {
  return (req, res, next) => middleware(req, res, async (error) => {
    const files = requestFiles(req);
    try {
      if (error) throw error;
      if (maxTotalBytes && files.reduce((sum, file) => sum + file.size, 0) > maxTotalBytes) {
        const tooLarge = new Error('Tổng dung lượng file vượt giới hạn');
        tooLarge.status = 413;
        throw tooLarge;
      }
      const { fileTypeFromFile } = await import('file-type');
      for (const file of files) {
        const detected = await fileTypeFromFile(file.path);
        const expected = types[path.extname(file.filename).toLowerCase()];
        const heifAlias = ['image/heic', 'image/heif'].includes(expected) &&
          ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(detected?.mime);
        if (!detected || !expected || (detected.mime !== expected && !heifAlias)) {
          const invalid = new Error('Nội dung file không khớp định dạng ảnh hoặc PDF');
          invalid.status = 400;
          throw invalid;
        }
        file.mimetype = detected.mime;
      }
      // A later validation or authorization failure must not leave public files behind.
      res.once('finish', () => {
        if (res.statusCode >= 400) void removeUploads(files);
      });
      return next();
    } catch (failure) {
      await removeUploads(files);
      const status = failure.status === 413 || failure.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ message: 'File không hợp lệ hoặc vượt giới hạn tải lên' });
    }
  });
}

function uploadResponseHeaders(res, filename, types = IMAGE_TYPES) {
  const mime = types[path.extname(filename).toLowerCase()];
  if (!mime) return false;
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
  return true;
}

module.exports = {
  IMAGE_TYPES, DELIVERY_TYPES, uploadFilename, uploadFilter,
  secureUpload, uploadResponseHeaders,
};

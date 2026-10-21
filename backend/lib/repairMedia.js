const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform, pipeline } = require('node:stream');
const multer = require('multer');

const MIB = 1024 * 1024;
const LIMITS = { files: 6, videos: 2, imageBytes: 10 * MIB, videoBytes: 50 * MIB, totalBytes: 100 * MIB };
const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
};
const ACKNOWLEDGMENT_VERSION = 'repair-media-v1';
const STORAGE_KEY = /^[a-f0-9]{32}\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|heic|heif|mp4|mov|webm)$/;

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function storageRoot() {
  return path.resolve(process.env.REPAIR_MEDIA_DIR || path.join(__dirname, '..', 'private', 'repair-media'));
}

function mediaPath(key, root = storageRoot()) {
  if (!STORAGE_KEY.test(String(key || ''))) throw failure('Không tìm thấy file', 404);
  return path.join(root, key);
}

function originalName(name) {
  return path.basename(String(name || '').replace(/\\/g, '/'))
    .replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180) || 'media';
}

async function directoryBytes(root) {
  let total = 0;
  for (const item of await fsp.readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) total += await directoryBytes(filename);
    else if (item.isFile()) total += (await fsp.stat(filename)).size;
  }
  return total;
}

function sameMime(expected, detected) {
  if (detected === 'image/jpg') detected = 'image/jpeg';
  const heif = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
  return expected === detected || (heif.includes(expected) && heif.includes(detected));
}

function publicMedia(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id, original_name: item.original_name, mime_type: item.mime_type,
    size: item.size, sha256: item.sha256, uploaded_at: item.uploaded_at, source: item.source,
  }));
}

function createRepairMediaUpload({ root, limits = LIMITS, storageLimitBytes, maxConcurrent = 2 } = {}) {
  let active = 0;
  return async (req, res, next) => {
    if (!req.is('multipart/form-data')) return next();
    if (active >= maxConcurrent) return res.status(429).json({ message: 'Đang có nhiều file tải lên. Vui lòng thử lại sau.' });
    const contentLength = Number(req.headers['content-length']);
    if (contentLength > limits.totalBytes + 64 * 1024) {
      return res.status(413).json({ message: 'Tổng dung lượng file vượt giới hạn 100 MB' });
    }

    active += 1;
    const context = { bytes: 0, videos: 0, committed: false, released: false, directory: null, files: [] };
    req.repairMedia = context;
    context.dispose = async () => {
      if (context.released) return;
      context.released = true;
      try {
        if (!context.committed && context.directory) await fsp.rm(context.directory, { recursive: true, force: true });
      } finally { active -= 1; }
    };

    try {
      const destinationRoot = root || storageRoot();
      await fsp.mkdir(destinationRoot, { recursive: true, mode: 0o700 });
      const configured = Number(process.env.REPAIR_MEDIA_STORAGE_LIMIT_MB || 2048);
      const quota = storageLimitBytes ?? (Number.isFinite(configured) && configured > 0 ? configured * MIB : 2048 * MIB);
      // Reserve a full request per active writer; the filesystem also needs headroom.
      if ((await directoryBytes(destinationRoot)) + active * limits.totalBytes > quota) {
        throw failure('Kho đính kèm tạm đầy. Vui lòng liên hệ lab hoặc gửi lại sau.', 503);
      }
      const disk = await fsp.statfs(destinationRoot);
      if (Number(disk.bavail) * Number(disk.bsize) < active * limits.totalBytes + 100 * MIB) {
        throw failure('Kho đính kèm tạm đầy. Vui lòng liên hệ lab hoặc gửi lại sau.', 503);
      }
      const batch = crypto.randomBytes(16).toString('hex');
      context.directory = path.join(destinationRoot, batch);
      await fsp.mkdir(context.directory, { mode: 0o700 });

      const storage = {
        _handleFile(request, file, callback) {
          const extension = path.extname(file.originalname).toLowerCase();
          const id = crypto.randomBytes(16).toString('hex');
          const filename = `${id}${extension}`;
          const target = path.join(context.directory, filename);
          const maxBytes = TYPES[extension].startsWith('video/') ? limits.videoBytes : limits.imageBytes;
          const hash = crypto.createHash('sha256');
          let size = 0;
          const counter = new Transform({
            transform(chunk, _encoding, done) {
              size += chunk.length;
              context.bytes += chunk.length;
              if (size > maxBytes || context.bytes > limits.totalBytes) {
                return done(failure('File hoặc tổng dung lượng vượt giới hạn tải lên', 413));
              }
              hash.update(chunk);
              done(null, chunk);
            },
          });
          const output = fs.createWriteStream(target, { flags: 'wx', mode: 0o600 });
          const abort = () => counter.destroy(failure('Tải file bị gián đoạn'));
          request.once('aborted', abort);
          pipeline(file.stream, counter, output, (error) => {
            request.removeListener('aborted', abort);
            if (error) {
              fsp.rm(target, { force: true }).then(() => callback(error), () => callback(error));
            } else {
              callback(null, { path: target, filename, size, id, storage_key: `${batch}/${filename}`, sha256: hash.digest('hex') });
            }
          });
        },
        _removeFile(_request, file, callback) {
          if (!file.path) return callback(null);
          fs.unlink(file.path, (error) => callback(error?.code === 'ENOENT' ? null : error));
        },
      };
      const upload = multer({
        storage,
        defParamCharset: 'utf8',
        limits: {
          files: limits.files, fileSize: limits.videoBytes, fields: 20, fieldSize: 2048,
          parts: 26, headerPairs: 100, fieldNestingDepth: 0, fieldArrayIndexLimit: 0,
        },
        fileFilter(_request, file, callback) {
          const expected = TYPES[path.extname(file.originalname || '').toLowerCase()];
          if (!expected || !(file.mimetype === 'application/octet-stream' || sameMime(expected, file.mimetype))) {
            return callback(failure('Chỉ nhận ảnh JPG, PNG, WebP, HEIC và video MP4, MOV, WebM'));
          }
          if (expected.startsWith('video/') && ++context.videos > limits.videos) {
            return callback(failure('Mỗi yêu cầu chỉ nhận tối đa 2 video'));
          }
          callback(null, true);
        },
      }).array('media', limits.files);

      if (req.aborted || req.destroyed) throw failure('Tải file bị gián đoạn');
      req.setTimeout(180000);
      const deadline = setTimeout(() => req.destroy(failure('Tải file quá thời gian cho phép', 408)), 180000);
      deadline.unref();
      upload(req, res, async (error) => {
        clearTimeout(deadline);
        try {
          if (error) throw error;
          if (req.aborted) throw failure('Tải file bị gián đoạn');
          const { fileTypeFromFile } = await import('file-type');
          const uploadedAt = new Date();
          for (const file of req.files || []) {
            const detected = await fileTypeFromFile(file.path);
            const expected = TYPES[path.extname(file.filename).toLowerCase()];
            if (!detected || !sameMime(expected, detected.mime)) throw failure('Nội dung file không khớp định dạng ảnh hoặc video');
            context.files.push({
              id: file.id, storage_key: file.storage_key, original_name: originalName(file.originalname),
              mime_type: detected.mime, size: file.size, sha256: file.sha256,
              uploaded_at: uploadedAt, source: 'customer',
            });
          }
          if (context.files.length && req.body?.media_acknowledged !== 'true') {
            throw failure('Vui lòng xác nhận ảnh/video thuộc máy bạn gửi trước khi tiếp tục');
          }
          next();
        } catch (uploadError) {
          await context.dispose();
          const status = uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : uploadError.status || 400;
          res.status(status).json({ message: uploadError.status ? uploadError.message : 'File không hợp lệ hoặc vượt giới hạn tải lên' });
        }
      });
    } catch (error) {
      await context.dispose();
      res.status(error.status || 503).json({ message: error.status ? error.message : 'Chưa tải được đính kèm. Vui lòng thử lại sau.' });
    }
  };
}

const repairMediaUpload = createRepairMediaUpload();

module.exports = {
  LIMITS, TYPES, ACKNOWLEDGMENT_VERSION, STORAGE_KEY,
  mediaPath, publicMedia, createRepairMediaUpload, repairMediaUpload,
};

const express = require('express');
const Film = require('../models/Film');
const Customer = require('../models/Customer');
const { verifyToken } = require('./auth');
const {
  sendConfirmationEmail,
  sendCompletionEmail,
  sendDeliveryEmail,
  formatEmailNote,
} = require('../services/emailService');
const { buildFilmReceiptEmailHtml } = require('../templates/filmReceiptEmail');
const { generateTicketNumber, pushStatusHistory } = require('../utils/filmHelpers');
const {
  filmTypeFromDetail,
  normalizeIntakeChecklist,
} = require('../utils/intakeChecklist');
const { consumeChemicalsForFilm } = require('../services/inventoryService');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const MulterError = multer.MulterError;
const {
  ensureDeliveryFolder,
  addUploadedFiles,
  getDeliveryDir,
  getPublicGalleryUrl,
  sanitizeFilename,
} = require('../services/deliveryFolderService');
const {
  isGoogleDriveConfigured,
  uploadFilmDeliveryToDrive,
} = require('../services/googleDriveService');

const router = express.Router();

const deliveryUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, getDeliveryDir(req.deliverySlug));
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 40 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.heic', '.heif', '.pdf'];
    const okMime =
      /^image\//.test(file.mimetype) ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'image/heic' ||
      file.mimetype === 'image/heif';
    const okExt =
      allowedExt.includes(ext) &&
      (!file.mimetype || file.mimetype === 'application/octet-stream');
    if (okMime || okExt) {
      cb(null, true);
    } else {
      cb(new Error(`Định dạng không hỗ trợ: ${file.originalname || file.mimetype}`));
    }
  },
});

const runDeliveryUpload = (req, res, next) => {
  deliveryUpload.array('files', 40)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'Mỗi file tối đa 100MB — nén ảnh hoặc tách file nhỏ hơn',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Tối đa 40 file mỗi lần tải' });
      }
      return res.status(400).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message || 'Upload thất bại' });
  });
};

const attachDeliveryFilm = async (req, res, next) => {
  try {
    const film = await Film.findById(req.params.id);
    if (!film) return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    if (!['completed', 'delivered'].includes(film.status)) {
      return res.status(400).json({ message: 'Phiếu phải ở bước đã hoàn thành tráng' });
    }
    ensureDeliveryFolder(film);
    await film.save();
    req.film = film;
    req.deliverySlug = film.deliverySlug;
    next();
  } catch (error) {
    next(error);
  }
};

const generateFilmCode = () => `FM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
const generateConfirmationCode = () => crypto.randomBytes(6).toString('hex').toUpperCase();

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const populateAndSort = (query) =>
  query.populate('customerId').populate('createdBy', 'name email').sort({ createdAt: -1 });

/** Admin xác nhận trả ảnh — không cần mã khách; gửi email thông báo đã trả. */
async function markFilmDelivered(film, userId, { skipEmail = false } = {}) {
  if (film.status !== 'completed') {
    throw new Error('Phiếu chưa sẵn sàng trả (chưa hoàn thành tráng)');
  }

  const customer = await Customer.findById(film.customerId);
  if (!customer) throw new Error('Không tìm thấy khách hàng');

  const ticketLabel = film.ticketNumber || film.filmCode;
  film.status = 'delivered';
  film.deliveredAt = Date.now();
  pushStatusHistory(film, 'delivered', 'Admin xác nhận đã trả ảnh', userId);

  const emailResult = skipEmail
    ? { sent: false, skipped: true }
    : await sendDeliveryEmail(
        customer.email,
        customer.firstName,
        ticketLabel,
        film._id,
        customer._id
      );

  if (emailResult.sent) {
    film.deliveryEmailSentAt = Date.now();
    film.emailDeliveryConfirmedAt = Date.now();
  }
  await film.save();

  return { emailResult, ticketLabel };
}

// Tìm phiếu: email, SĐT, mã phiếu, mã xác nhận
router.get('/search', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json([]);
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const customers = await Customer.find({
      $or: [{ email: regex }, { phone: regex }, { firstName: regex }, { lastName: regex }],
    }).select('_id');

    const customerIds = customers.map((c) => c._id);
    const upperQ = q.toUpperCase();

    const films = await populateAndSort(
      Film.find({
        $or: [
          { customerId: { $in: customerIds } },
          { ticketNumber: regex },
          { filmCode: regex },
          { confirmationCode: upperQ },
          { confirmationCode: regex },
        ],
      })
    );

    res.json(films);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tìm kiếm phiếu', error: error.message });
  }
});

// Danh sách phiếu
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};

    if (status) filter.status = status;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const films = await populateAndSort(Film.find(filter));
    res.json(films);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching films', error: error.message });
  }
});

// ——— Batch (nhiều phiếu) ———
router.post('/batch/start-processing', verifyToken, async (req, res) => {
  try {
    const { ids = [], note } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Chọn ít nhất một phiếu' });
    }

    const success = [];
    const failed = [];

    for (const id of ids) {
      try {
        const film = await Film.findById(id);
        if (!film) throw new Error('Không tìm thấy phiếu');
        if (film.status !== 'received') throw new Error('Không ở trạng thái tiếp nhận');

        film.status = 'processing';
        film.processingStartedAt = Date.now();
        pushStatusHistory(film, 'processing', note || 'Bắt đầu tráng (hàng loạt)', req.userId);
        await film.save();
        await consumeChemicalsForFilm(film, req.userId);
        success.push(id);
      } catch (e) {
        failed.push({ id, message: e.message });
      }
    }

    res.json({
      message: `Đã bắt đầu tráng ${success.length}/${ids.length} phiếu`,
      successCount: success.length,
      failedCount: failed.length,
      failed,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi batch tráng', error: error.message });
  }
});

router.post('/batch/complete', verifyToken, async (req, res) => {
  try {
    const { ids = [], processingNotes } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Chọn ít nhất một phiếu' });
    }

    const success = [];
    const failed = [];
    const note = processingNotes || 'Hoàn thành tráng (hàng loạt)';

    for (const id of ids) {
      try {
        const film = await Film.findById(id);
        if (!film) throw new Error('Không tìm thấy phiếu');
        if (film.status !== 'processing') throw new Error('Chưa ở bước đang tráng');

        film.status = 'completed';
        film.completedAt = Date.now();
        film.processingNotes = note;
        pushStatusHistory(film, 'completed', note, req.userId);
        ensureDeliveryFolder(film);
        await film.save();
        success.push({
          id,
          deliverySlug: film.deliverySlug,
          galleryUrl: getPublicGalleryUrl(film.deliverySlug),
        });
      } catch (e) {
        failed.push({ id, message: e.message });
      }
    }

    res.json({
      message: `Đã hoàn thành ${success.length}/${ids.length} phiếu — tải ảnh vào folder rồi gửi link khách`,
      successCount: success.length,
      failedCount: failed.length,
      failed,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi batch hoàn thành', error: error.message });
  }
});

router.post('/batch/deliver', verifyToken, async (req, res) => {
  try {
    const ids =
      req.body.ids ||
      (Array.isArray(req.body.items) ? req.body.items.map((i) => i.id) : []);
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Chọn ít nhất một phiếu' });
    }

    const success = [];
    const failed = [];
    let emailsSent = 0;

    for (const id of ids) {
      try {
        const film = await Film.findById(id);
        if (!film) throw new Error('Không tìm thấy phiếu');
        const { emailResult } = await markFilmDelivered(film, req.userId, {
          skipEmail: Boolean(req.body?.skipEmail),
        });
        if (emailResult.sent) emailsSent += 1;
        success.push(id);
      } catch (e) {
        failed.push({ id, message: e.message });
      }
    }

    res.json({
      message: `Đã trả ảnh ${success.length}/${ids.length} phiếu. Đã gửi ${emailsSent} email cho khách.`,
      successCount: success.length,
      failedCount: failed.length,
      emailsSent,
      failed,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi batch trả ảnh', error: error.message });
  }
});

// Xem trước HTML email phiếu tiếp nhận (giống nội dung gửi khách)
router.get('/:id/receipt-email', verifyToken, async (req, res) => {
  try {
    const film = await Film.findById(req.params.id).populate('customerId');
    if (!film) return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    res.type('html').send(buildFilmReceiptEmailHtml(film, film.customerId));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo HTML phiếu', error: error.message });
  }
});

// Chi tiết phiếu
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const film = await Film.findById(req.params.id)
      .populate('customerId')
      .populate('createdBy', 'name email')
      .populate('statusHistory.by', 'name');

    if (!film) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    }
    res.json(film);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching film', error: error.message });
  }
});

// Tạo phiếu tiếp nhận
router.post('/receive', verifyToken, async (req, res) => {
  try {
    const { customerId, quantity, filmType, receptionNotes, intakeChecklist } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    const checklist = normalizeIntakeChecklist(intakeChecklist, customer);
    checklist.checklistCompletedAt = new Date();

    const resolvedFilmType =
      filmType ||
      filmTypeFromDetail(checklist.filmTypeDetail) ||
      'color';

    const ticketNumber = await generateTicketNumber();
    const filmCode = generateFilmCode();
    const confirmationCode = generateConfirmationCode();

    const film = new Film({
      customerId,
      ticketNumber,
      filmCode,
      confirmationCode,
      quantity: quantity || 1,
      filmType: resolvedFilmType,
      receptionNotes,
      intakeChecklist: checklist,
      status: 'received',
      createdBy: req.userId,
    });

    pushStatusHistory(
      film,
      'received',
      'Tạo phiếu tiếp nhận — checklist develop & scan hoàn tất',
      req.userId
    );
    await film.save();

    const slip = await Film.findById(film._id).populate('customerId').populate('createdBy', 'name');
    const skipEmail = Boolean(req.body?.skipEmail);
    const emailResult = skipEmail
      ? { sent: false, skipped: true }
      : await sendConfirmationEmail(slip);
    if (emailResult.sent) {
      film.emailSentAt = Date.now();
      await film.save();
    }

    res.status(201).json({
      message: skipEmail
        ? 'Đã tạo phiếu tiếp nhận (email đã gửi từ máy)'
        : `Đã tạo phiếu tiếp nhận${formatEmailNote(emailResult)}`,
      film: slip,
      slip,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped,
      emailError: emailResult.error || null,
    });
  } catch (error) {
    const isValidation = error.name === 'ValidationError';
    res.status(isValidation ? 400 : 500).json({
      message: isValidation ? 'Dữ liệu checklist không hợp lệ' : 'Lỗi tạo phiếu tiếp nhận',
      error: error.message,
    });
  }
});

// Bắt đầu tráng
router.put('/:id/start-processing', verifyToken, async (req, res) => {
  try {
    const film = await Film.findById(req.params.id);
    if (!film) return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    if (film.status !== 'received') {
      return res.status(400).json({ message: 'Phiếu không ở trạng thái tiếp nhận' });
    }

    film.status = 'processing';
    film.processingStartedAt = Date.now();
    pushStatusHistory(film, 'processing', req.body.note || 'Bắt đầu tráng film', req.userId);
    await film.save();
    await consumeChemicalsForFilm(film, req.userId);

    const updated = await Film.findById(film._id).populate('customerId');
    res.json({ message: 'Đã bắt đầu tráng', film: updated });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật tiến độ', error: error.message });
  }
});

// Hoàn thành tráng — tạo folder ảnh (chưa gửi email; gửi sau khi upload)
router.put('/:id/complete', verifyToken, async (req, res) => {
  try {
    const { processingNotes } = req.body;
    const film = await Film.findById(req.params.id);

    if (!film) return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    if (film.status !== 'processing') {
      return res.status(400).json({ message: 'Phiếu chưa ở bước đang tráng' });
    }

    film.status = 'completed';
    film.completedAt = Date.now();
    film.processingNotes = processingNotes;
    pushStatusHistory(film, 'completed', processingNotes || 'Hoàn thành tráng', req.userId);
    ensureDeliveryFolder(film);
    await film.save();

    const galleryUrl = getPublicGalleryUrl(film.deliverySlug);
    const updated = await Film.findById(film._id).populate('customerId');
    res.json({
      message: 'Đã hoàn thành tráng — tải ảnh vào folder, sau đó gửi link cho khách',
      film: updated,
      deliverySlug: film.deliverySlug,
      galleryUrl,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hoàn thành tráng', error: error.message });
  }
});

// Tải ảnh scan vào folder phiếu
router.post(
  '/:id/delivery-files',
  verifyToken,
  attachDeliveryFilm,
  runDeliveryUpload,
  async (req, res) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ message: 'Chọn ít nhất một file ảnh' });
      }
      const film = req.film;
      const uploaded = req.files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
      }));
      addUploadedFiles(film, uploaded);
      await film.save();

      const updated = await Film.findById(film._id).populate('customerId');
      res.json({
        message: `Đã tải ${uploaded.length} file vào folder`,
        film: updated,
        galleryUrl: getPublicGalleryUrl(film.deliverySlug),
        fileCount: film.deliveryFiles.length,
      });
    } catch (error) {
      res.status(500).json({ message: 'Lỗi tải ảnh', error: error.message });
    }
  }
);

// Đồng bộ folder lên Google Drive (không gửi email)
router.post('/:id/sync-drive', verifyToken, attachDeliveryFilm, async (req, res) => {
  try {
    if (!isGoogleDriveConfigured()) {
      return res.status(503).json({
        message:
          'Chưa cấu hình Google Drive — đặt credentials.json và GOOGLE_DRIVE_PARENT_FOLDER_ID',
      });
    }
    const film = req.film;
    const force = Boolean(req.body?.force);
    const driveResult = await uploadFilmDeliveryToDrive(film, { forceNewFolder: force });
    film.driveFolderId = driveResult.folderId;
    film.driveWebViewLink = driveResult.webViewLink;
    film.driveSyncedAt = Date.now();
    pushStatusHistory(
      film,
      'completed',
      `Đã đồng bộ ${driveResult.uploadedCount} ảnh lên Google Drive`,
      req.userId
    );
    await film.save();

    const updated = await Film.findById(film._id).populate('customerId');
    res.json({
      message: `Đã tải ${driveResult.uploadedCount} ảnh lên Google Drive`,
      film: updated,
      driveWebViewLink: driveResult.webViewLink,
      uploadedCount: driveResult.uploadedCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đồng bộ Google Drive', error: error.message });
  }
});

// Gửi email cho khách — ưu tiên link Google Drive nếu đã cấu hình
router.post('/:id/send-gallery-link', verifyToken, attachDeliveryFilm, async (req, res) => {
  try {
    const film = req.film;
    const fileCount = film.deliveryFiles?.length || 0;
    if (fileCount === 0) {
      return res.status(400).json({ message: 'Folder chưa có ảnh — hãy tải ảnh trước' });
    }

    const customer = await Customer.findById(film.customerId);
    if (!customer?.email) {
      return res.status(400).json({ message: 'Khách hàng chưa có email' });
    }

    const ticketLabel = film.ticketNumber || film.filmCode;
    const galleryUrl = getPublicGalleryUrl(film.deliverySlug);
    const forceDrive = Boolean(req.body?.force);
    const driveRequired = process.env.GOOGLE_DRIVE_REQUIRED === 'true';
    const useDrive = isGoogleDriveConfigured();

    let customerLink = galleryUrl;
    let linkKind = 'local';
    let driveSync = null;
    let driveError = null;

    if (useDrive && (forceDrive || !film.driveWebViewLink)) {
      try {
        driveSync = await uploadFilmDeliveryToDrive(film, { forceNewFolder: forceDrive });
        film.driveFolderId = driveSync.folderId;
        film.driveWebViewLink = driveSync.webViewLink;
        film.driveSyncedAt = Date.now();
        customerLink = driveSync.webViewLink;
        linkKind = 'drive';
      } catch (err) {
        driveError = err.message;
        if (driveRequired) {
          return res.status(503).json({
            message: `Không đồng bộ được Google Drive: ${driveError}`,
            driveError,
          });
        }
        console.warn('Google Drive sync failed, fallback to local gallery:', driveError);
      }
    } else if (useDrive && film.driveWebViewLink) {
      customerLink = film.driveWebViewLink;
      linkKind = 'drive';
    }

    const emailResult = await sendCompletionEmail(
      customer.email,
      customer.firstName,
      ticketLabel,
      film._id,
      customer._id,
      customerLink,
      {
        linkKind,
        fallbackGalleryUrl: linkKind === 'drive' ? galleryUrl : null,
      }
    );

    if (emailResult.sent) {
      film.completionEmailSentAt = Date.now();
      const via = linkKind === 'drive' ? 'Google Drive' : 'gallery web';
      pushStatusHistory(
        film,
        'completed',
        `Đã gửi link ảnh (${fileCount} file) qua ${via}`,
        req.userId
      );
      await film.save();
    }

    const updated = await Film.findById(film._id).populate('customerId');
    const driveNote =
      linkKind === 'drive'
        ? ' — link Google Drive'
        : driveError
          ? ` (Drive lỗi: ${driveError}, dùng link web)`
          : '';

    res.json({
      message: `Đã gửi link album cho khách${driveNote}${formatEmailNote(emailResult)}`,
      film: updated,
      galleryUrl,
      driveWebViewLink: film.driveWebViewLink || null,
      customerLink,
      linkKind,
      fileCount,
      driveUploadedCount: driveSync?.uploadedCount || null,
      driveError,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped,
      emailError: emailResult.error || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi gửi link', error: error.message });
  }
});

// Trả ảnh — admin xác nhận, gửi email cho khách
router.put('/:id/deliver', verifyToken, async (req, res) => {
  try {
    const film = await Film.findById(req.params.id);
    if (!film) return res.status(404).json({ message: 'Không tìm thấy phiếu' });

    const { emailResult } = await markFilmDelivered(film, req.userId, {
      skipEmail: Boolean(req.body?.skipEmail),
    });
    const updated = await Film.findById(film._id).populate('customerId');

    res.json({
      message: req.body?.skipEmail
        ? 'Đã trả ảnh thành công (email đã gửi từ máy)'
        : `Đã trả ảnh thành công${formatEmailNote(emailResult)}`,
      film: updated,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped,
      emailError: emailResult.error || null,
    });
  } catch (error) {
    const status = error.message?.includes('sẵn sàng') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Lỗi trả ảnh', error: error.message });
  }
});

module.exports = router;

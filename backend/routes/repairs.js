const express = require('express');
const mongoose = require('mongoose');
const CustomerRepairTicket = require('../models/CustomerRepairTicket');
const { mediaPath, TYPES } = require('../lib/repairMedia');
const { verifyToken } = require('./auth');
const { formatEmailNote } = require('../services/emailService');
const {
  listTickets,
  getTicketById,
  createTicket,
  markGoodsReceived,
  sendQuote,
  confirmAtCounter,
  addWorkLog,
  markReady,
  markReturned,
  cancelTicket,
  getOpsSummary,
  mapTicket,
  asStaffView,
  redactOpsSummary,
} = require('../services/customerRepairService');

function ticketFor(req, ticket) {
  return mapTicket(ticket, asStaffView(req.userRole));
}

const router = express.Router();

router.get('/:id/media/:mediaId', verifyToken, async (req, res, next) => {
  try {
    if (!['owner', 'admin', 'staff'].includes(req.userRole)) return res.status(403).json({ message: 'Không có quyền xem đính kèm' });
    if (!mongoose.isValidObjectId(req.params.id) || !/^[a-f0-9]{32}$/.test(req.params.mediaId)) {
      return res.status(404).json({ message: 'Không tìm thấy file' });
    }
    const ticket = await CustomerRepairTicket.findById(req.params.id).select('intake_media');
    const file = ticket?.intake_media?.find((item) => item.id === req.params.mediaId);
    if (!file || !Object.values(TYPES).some((mime) => mime === file.mime_type || mime.startsWith('image/hei') && file.mime_type?.startsWith('image/hei'))) {
      return res.status(404).json({ message: 'Không tìm thấy file' });
    }
    const filename = mediaPath(file.storage_key);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-SHA256', file.sha256);
    res.type(file.mime_type);
    if (req.query.download === '1') res.attachment(file.original_name);
    res.sendFile(filename, { dotfiles: 'deny', cacheControl: false }, (error) => {
      if (!error) return;
      if (res.headersSent) return next(error);
      res.status(error.status === 404 || error.code === 'ENOENT' ? 404 : 500).json({ message: 'Không tải được file' });
    });
  } catch (_error) {
    if (!res.headersSent) res.status(404).json({ message: 'Không tìm thấy file' });
  }
});

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const summary = await getOpsSummary();
    res.json(redactOpsSummary(summary, req.userRole));
  } catch (error) {
    res.status(500).json({ message: 'Không tải được tổng quan sửa máy', error: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const tickets = await listTickets({ status: req.query.status, q: req.query.q });
    res.json(tickets.map((t) => ticketFor(req, t)));
  } catch (error) {
    res.status(500).json({ message: 'Không tải được danh sách phiếu', error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    res.json(ticketFor(req, ticket));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải phiếu', error: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await createTicket(req.body, req.userId);
    res.status(201).json({
      message: `Đã tạo phiếu tiếp nhận${formatEmailNote(emailResult)}`,
      ticket: ticketFor(req, ticket),
      emailSent: emailResult?.sent,
      emailSkipped: emailResult?.skipped,
      emailError: emailResult?.error || null,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Lỗi tạo phiếu',
      error: error.message,
    });
  }
});

router.post('/:id/receive-goods', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await markGoodsReceived(
      req.params.id,
      req.userId,
      req.body
    );
    res.json({
      message: `Đã nhận máy${formatEmailNote(emailResult)}`,
      ticket: ticketFor(req, ticket),
      emailSent: emailResult?.sent,
      emailSkipped: emailResult?.skipped,
      emailError: emailResult?.error || null,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Lỗi nhận máy',
      error: error.message,
    });
  }
});

router.post('/:id/quote', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await sendQuote(req.params.id, req.body, req.userId);
    res.json({
      message: `Đã gửi báo giá${formatEmailNote(emailResult)}`,
      ticket: ticketFor(req, ticket),
      emailSent: emailResult?.sent,
      emailSkipped: emailResult?.skipped,
      emailError: emailResult?.error || null,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi gửi báo giá', error: error.message });
  }
});

router.post('/:id/confirm-counter', verifyToken, async (req, res) => {
  try {
    const ticket = await confirmAtCounter(req.params.id, req.userId);
    res.json({ message: 'Khách đã xác nhận tại quầy — bắt đầu sửa', ticket: ticketFor(req, ticket) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi xác nhận', error: error.message });
  }
});

router.post('/:id/work-logs', verifyToken, async (req, res) => {
  try {
    const ticket = await addWorkLog(req.params.id, req.body, req.userId, req.userRole);
    res.json({ message: 'Đã ghi nhật ký sửa', ticket: ticketFor(req, ticket) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi ghi nhật ký', error: error.message });
  }
});

router.post('/:id/ready', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await markReady(req.params.id, req.body, req.userId);
    res.json({
      message: `Máy sẵn sàng trả${formatEmailNote(emailResult)}`,
      ticket: ticketFor(req, ticket),
      emailSent: emailResult?.sent,
      emailSkipped: emailResult?.skipped,
      emailError: emailResult?.error || null,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi cập nhật', error: error.message });
  }
});

router.post('/:id/return', verifyToken, async (req, res) => {
  try {
    const ticket = await markReturned(req.params.id, req.body, req.userId);
    res.json({ message: 'Đã trả máy cho khách', ticket: ticketFor(req, ticket) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi trả máy', error: error.message });
  }
});

router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const ticket = await cancelTicket(req.params.id, req.body?.note, req.userId);
    res.json({ message: 'Đã hủy phiếu', ticket: ticketFor(req, ticket) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi hủy phiếu', error: error.message });
  }
});

module.exports = router;

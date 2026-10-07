const express = require('express');
const { verifyToken } = require('./auth');
const { formatEmailNote } = require('../services/emailService');
const {
  listTickets,
  getTicketById,
  createTicket,
  sendQuote,
  confirmAtCounter,
  addWorkLog,
  markReady,
  markReturned,
  cancelTicket,
  getOpsSummary,
} = require('../services/customerRepairService');

const router = express.Router();

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const summary = await getOpsSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Không tải được tổng quan sửa máy', error: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const tickets = await listTickets({ status: req.query.status, q: req.query.q });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Không tải được danh sách phiếu', error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Không tìm thấy phiếu' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải phiếu', error: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await createTicket(req.body, req.userId);
    res.status(201).json({
      message: `Đã tạo phiếu tiếp nhận${formatEmailNote(emailResult)}`,
      ticket,
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

router.post('/:id/quote', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await sendQuote(req.params.id, req.body, req.userId);
    res.json({
      message: `Đã gửi báo giá${formatEmailNote(emailResult)}`,
      ticket,
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
    res.json({ message: 'Khách đã xác nhận tại quầy — bắt đầu sửa', ticket });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi xác nhận', error: error.message });
  }
});

router.post('/:id/work-logs', verifyToken, async (req, res) => {
  try {
    const ticket = await addWorkLog(req.params.id, req.body, req.userId);
    res.json({ message: 'Đã ghi nhật ký sửa', ticket });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi ghi nhật ký', error: error.message });
  }
});

router.post('/:id/ready', verifyToken, async (req, res) => {
  try {
    const { ticket, emailResult } = await markReady(req.params.id, req.body, req.userId);
    res.json({
      message: `Máy sẵn sàng trả${formatEmailNote(emailResult)}`,
      ticket,
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
    res.json({ message: 'Đã trả máy cho khách', ticket });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi trả máy', error: error.message });
  }
});

router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const ticket = await cancelTicket(req.params.id, req.body?.note, req.userId);
    res.json({ message: 'Đã hủy phiếu', ticket });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi hủy phiếu', error: error.message });
  }
});

module.exports = router;

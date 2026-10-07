const express = require('express');
const { confirmByToken } = require('../services/customerRepairService');
const { STATUS_LABELS } = require('../constants/customerRepair');

const router = express.Router();

/** Xem thông tin phiếu qua token (không lộ toàn bộ DB) */
router.get('/:token', async (req, res) => {
  try {
    const ticket = await require('../models/CustomerRepairTicket')
      .findOne({ confirm_token: req.params.token })
      .select(
        'ticket_number customer_name model_name serial_number quote_amount quote_note quote_lines deposit_amount status confirm_token_expires'
      )
      .lean();

    if (!ticket) {
      return res.status(404).json({ message: 'Link không hợp lệ hoặc đã hết hạn' });
    }

    res.json({
      ticket_number: ticket.ticket_number,
      customer_name: ticket.customer_name,
      model_name: ticket.model_name,
      serial_number: ticket.serial_number,
      quote_amount: ticket.quote_amount,
      quote_note: ticket.quote_note,
      quote_lines: ticket.quote_lines,
      deposit_amount: ticket.deposit_amount,
      status: ticket.status,
      status_label: STATUS_LABELS[ticket.status],
      expired: Boolean(ticket.confirm_token_expires && ticket.confirm_token_expires < new Date()),
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải phiếu', error: error.message });
  }
});

router.post('/:token', async (req, res) => {
  try {
    const action = String(req.body.action || req.query.action || '').toLowerCase();
    const accept = action === 'accept' || action === 'yes' || action === 'dong_y';
    const decline = action === 'decline' || action === 'no' || action === 'tu_choi';

    if (!accept && !decline) {
      return res.status(400).json({ message: 'Thiếu action: accept hoặc decline' });
    }

    const ticket = await confirmByToken(req.params.token, { accept });
    res.json({
      message: accept
        ? 'Cảm ơn bạn — tiệm sẽ tiến hành sửa máy.'
        : 'Đã ghi nhận từ chối báo giá. Vui lòng liên hệ tiệm để nhận lại máy.',
      ticket,
      status_label: STATUS_LABELS[ticket.status],
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi xác nhận', error: error.message });
  }
});

module.exports = router;

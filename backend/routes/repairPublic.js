const express = require('express');
const {
  confirmByToken,
  findByConfirmToken,
  isConfirmExpired,
  mapPublicQuote,
} = require('../services/customerRepairService');
const { STATUS_LABELS } = require('../constants/customerRepair');
const { rateLimit } = require('../middleware/rateLimit');
const { noStore } = require('../middleware/security');
const { publicError } = require('../lib/httpSafety');

const router = express.Router();
const INVALID = 'Link không hợp lệ hoặc đã hết hạn';

router.use(noStore);
router.use(
  rateLimit({
    max: 40,
    windowMs: 60 * 60 * 1000,
    bucket: 'repair-public',
    message: 'Quá nhiều yêu cầu. Thử lại sau.',
  })
);

router.get('/:token', async (req, res) => {
  try {
    const ticket = await findByConfirmToken(req.params.token);
    if (!ticket || isConfirmExpired(ticket)) {
      return res.status(404).json({ message: INVALID });
    }
    res.json(mapPublicQuote(ticket));
  } catch (_error) {
    res.status(500).json({ message: 'Không tải được phiếu' });
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
      status: ticket.status,
      status_label: STATUS_LABELS[ticket.status] || ticket.status_label,
    });
  } catch (error) {
    publicError(res, error, 'Không xác nhận được');
  }
});

module.exports = router;

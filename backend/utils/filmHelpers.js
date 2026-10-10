const Film = require('../models/Film');

const formatDateKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const generateTicketNumber = async () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const count = await Film.countDocuments({ createdAt: { $gte: start, $lte: end } });
  return `PH-${formatDateKey()}-${String(count + 1).padStart(4, '0')}`;
};

const pushStatusHistory = (film, status, note, userId) => {
  if (!film.statusHistory) film.statusHistory = [];
  film.statusHistory.push({
    status,
    note: note || '',
    at: new Date(),
    ...(userId ? { by: userId } : {}),
  });
};

const STATUS_LABELS = {
  received: 'Tiếp nhận',
  processing: 'Đang tráng',
  completed: 'Hoàn thành',
  delivered: 'Đã trả',
  cancelled: 'Hủy',
};

module.exports = {
  generateTicketNumber,
  pushStatusHistory,
  STATUS_LABELS,
};

const CustomerRepairTicket = require('../models/CustomerRepairTicket');
const { STATUS_DISPLAY_ORDER } = require('../constants/customerRepair');

const formatDateKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

async function generateRepairTicketNumber() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const count = await CustomerRepairTicket.countDocuments({
    createdAt: { $gte: start, $lte: end },
  });
  return `SRV-${formatDateKey()}-${String(count + 1).padStart(4, '0')}`;
}

function pushRepairStatusHistory(ticket, status, note, userId) {
  if (!ticket.statusHistory) ticket.statusHistory = [];
  ticket.statusHistory.push({
    status,
    note: note || '',
    at: new Date(),
    ...(userId ? { by: userId } : {}),
  });
}

function statusDisplayRank(status) {
  const idx = STATUS_DISPLAY_ORDER.indexOf(status);
  return idx === -1 ? STATUS_DISPLAY_ORDER.length : idx;
}

/** Ưu tiên pipeline → trong cùng trạng thái: cập nhật mới nhất trước */
function compareRepairTickets(a, b) {
  const rankDiff = statusDisplayRank(a.status) - statusDisplayRank(b.status);
  if (rankDiff !== 0) return rankDiff;
  const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return tB - tA;
}

function sortRepairTickets(rows) {
  return [...rows].sort(compareRepairTickets);
}

module.exports = {
  generateRepairTicketNumber,
  pushRepairStatusHistory,
  compareRepairTickets,
  sortRepairTickets,
};

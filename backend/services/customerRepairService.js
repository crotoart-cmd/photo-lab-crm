const crypto = require('crypto');
const Customer = require('../models/Customer');
const CustomerRepairTicket = require('../models/CustomerRepairTicket');
const {
  QUOTE_ALLOWED,
  WORKLOG_ALLOWED,
  STATUS_LABELS,
} = require('../constants/customerRepair');
const { generateRepairTicketNumber, pushRepairStatusHistory, sortRepairTickets } = require('../utils/repairHelpers');
const {
  sendRepairIntakeEmail,
  sendRepairQuoteEmail,
  sendRepairReadyEmail,
} = require('./emailService');

const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();

function getFrontendBase() {
  return require('../config/brand').getFrontendUrl();
}

function mapTicket(ticket) {
  const obj = ticket.toObject ? ticket.toObject() : ticket;
  const internalTotal = num(obj.internal_parts_cost) + num(obj.internal_labor_cost);
  const profitEstimate = num(obj.final_amount || obj.quote_amount) - internalTotal;
  return {
    ...obj,
    status_label: STATUS_LABELS[obj.status] || obj.status,
    internal_total_cost: internalTotal,
    profit_estimate: profitEstimate,
    amount_due: Math.max(0, num(obj.final_amount || obj.quote_amount) - num(obj.deposit_amount)),
  };
}

async function resolveCustomerFields({ customerId, customer_name, customer_email, customer_phone }) {
  let name = String(customer_name || '').trim();
  let email = normalizeEmail(customer_email);
  let phone = String(customer_phone || '').trim();
  let cid = customerId || null;

  if (customerId) {
    const customer = await Customer.findById(customerId).select('firstName lastName email phone');
    if (customer) {
      if (!name) name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      if (!email && customer.email) email = normalizeEmail(customer.email);
      if (!phone && customer.phone) phone = customer.phone;
      cid = customer._id;
    }
  }

  if (!name) {
    const err = new Error('Tên khách hàng là bắt buộc');
    err.status = 400;
    throw err;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Email khách hợp lệ là bắt buộc');
    err.status = 400;
    throw err;
  }

  return { customerId: cid, customer_name: name, customer_email: email, customer_phone: phone };
}

async function listTickets({ status, q } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { ticket_number: regex },
      { customer_name: regex },
      { customer_email: regex },
      { model_name: regex },
      { serial_number: regex },
    ];
  }
  const rows = await CustomerRepairTicket.find(filter)
    .populate('customerId', 'firstName lastName email phone')
    .populate('createdBy', 'name email')
    .lean();
  return sortRepairTickets(rows).map(mapTicket);
}

async function getTicketById(id) {
  const ticket = await CustomerRepairTicket.findById(id)
    .populate('customerId', 'firstName lastName email phone')
    .populate('createdBy', 'name email');
  if (!ticket) return null;
  return mapTicket(ticket);
}

async function createTicket(payload, userId) {
  const customer = await resolveCustomerFields(payload);
  const model_name = String(payload.model_name || '').trim();
  const symptom = String(payload.symptom || '').trim();
  if (!model_name) {
    const err = new Error('Model máy là bắt buộc');
    err.status = 400;
    throw err;
  }
  if (!symptom) {
    const err = new Error('Triệu chứng / mô tả lỗi là bắt buộc');
    err.status = 400;
    throw err;
  }

  const ticket_number = await generateRepairTicketNumber();
  const ticket = new CustomerRepairTicket({
    ticket_number,
    ...customer,
    model_name,
    brand: payload.brand || '',
    serial_number: String(payload.serial_number || '').trim().toUpperCase(),
    symptom,
    intake_note: payload.intake_note || '',
    condition_at_intake: payload.condition_at_intake || '',
    status: 'tiep_nhan',
    received_at: new Date(),
    createdBy: userId,
  });

  pushRepairStatusHistory(ticket, 'tiep_nhan', 'Tiếp nhận máy khách', userId);
  await ticket.save();

  const skipEmail = Boolean(payload.skipEmail);
  const emailResult = skipEmail
    ? { sent: false, skipped: true }
    : await sendRepairIntakeEmail(ticket);
  if (emailResult.sent) {
    ticket.intake_email_sent_at = Date.now();
    await ticket.save();
  }

  return { ticket: mapTicket(ticket), emailResult };
}

function newConfirmToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function sendQuote(ticketId, payload, userId) {
  const ticket = await CustomerRepairTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Không tìm thấy phiếu');
    err.status = 404;
    throw err;
  }
  if (!QUOTE_ALLOWED.includes(ticket.status)) {
    const err = new Error(`Không thể gửi báo giá ở trạng thái ${STATUS_LABELS[ticket.status]}`);
    err.status = 400;
    throw err;
  }

  const quote_amount = num(payload.quote_amount);
  if (quote_amount <= 0) {
    const err = new Error('Báo giá phải lớn hơn 0');
    err.status = 400;
    throw err;
  }

  const quote_lines = Array.isArray(payload.quote_lines)
    ? payload.quote_lines
        .filter((l) => l?.label)
        .map((l) => ({ label: String(l.label).trim(), amount: num(l.amount) }))
    : [];

  ticket.quote_amount = quote_amount;
  ticket.quote_note = payload.quote_note || '';
  ticket.quote_lines = quote_lines.length
    ? quote_lines
    : [{ label: 'Sửa chữa', amount: quote_amount }];
  ticket.deposit_amount = num(payload.deposit_amount);
  ticket.final_amount = quote_amount;
  ticket.confirm_token = newConfirmToken();
  ticket.confirm_token_expires = new Date(Date.now() + 7 * 86400000);
  ticket.status = 'cho_khach_xac_nhan';
  ticket.quote_sent_at = new Date();

  pushRepairStatusHistory(
    ticket,
    'cho_khach_xac_nhan',
    `Gửi báo giá ${quote_amount.toLocaleString('vi-VN')}đ`,
    userId
  );
  await ticket.save();

  const skipEmail = Boolean(payload.skipEmail);
  const emailResult = skipEmail
    ? { sent: false, skipped: true }
    : await sendRepairQuoteEmail(ticket);
  if (emailResult.sent) {
    ticket.quote_email_sent_at = Date.now();
    await ticket.save();
  }

  return { ticket: mapTicket(ticket), emailResult };
}

async function confirmByToken(token, { accept }) {
  const ticket = await CustomerRepairTicket.findOne({ confirm_token: token });
  if (!ticket) {
    const err = new Error('Link xác nhận không hợp lệ hoặc đã hết hạn');
    err.status = 404;
    throw err;
  }
  if (ticket.confirm_token_expires && ticket.confirm_token_expires < new Date()) {
    const err = new Error('Link xác nhận đã hết hạn — liên hệ tiệm');
    err.status = 410;
    throw err;
  }
  if (ticket.status !== 'cho_khach_xac_nhan') {
    const err = new Error('Phiếu đã được xử lý trước đó');
    err.status = 400;
    throw err;
  }

  if (accept) {
    ticket.status = 'dang_sua';
    ticket.confirmed_at = new Date();
    ticket.confirmed_via = 'email_link';
    ticket.repair_started_at = new Date();
    ticket.confirm_token = undefined;
    pushRepairStatusHistory(ticket, 'dang_sua', 'Khách xác nhận qua email', null);
  } else {
    ticket.status = 'khach_tu_choi';
    ticket.rejected_at = new Date();
    ticket.confirm_token = undefined;
    pushRepairStatusHistory(ticket, 'khach_tu_choi', 'Khách từ chối báo giá qua email', null);
  }

  await ticket.save();
  return mapTicket(ticket);
}

async function confirmAtCounter(ticketId, userId) {
  const ticket = await CustomerRepairTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Không tìm thấy phiếu');
    err.status = 404;
    throw err;
  }
  if (ticket.status !== 'cho_khach_xac_nhan') {
    const err = new Error('Phiếu không ở bước chờ khách xác nhận');
    err.status = 400;
    throw err;
  }
  ticket.status = 'dang_sua';
  ticket.confirmed_at = new Date();
  ticket.confirmed_via = 'counter';
  ticket.repair_started_at = new Date();
  ticket.confirm_token = undefined;
  pushRepairStatusHistory(ticket, 'dang_sua', 'Xác nhận tại quầy', userId);
  await ticket.save();
  return mapTicket(ticket);
}

async function addWorkLog(ticketId, payload, userId) {
  const ticket = await CustomerRepairTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Không tìm thấy phiếu');
    err.status = 404;
    throw err;
  }
  if (!WORKLOG_ALLOWED.includes(ticket.status)) {
    const err = new Error('Chỉ ghi nhật ký khi phiếu đang sửa');
    err.status = 400;
    throw err;
  }

  const description = String(payload.description || '').trim();
  if (!description) {
    const err = new Error('Mô tả công việc là bắt buộc');
    err.status = 400;
    throw err;
  }

  const parts = num(payload.parts_cost);
  const labor = num(payload.labor_cost);
  const total = parts + labor;

  ticket.work_logs.push({
    description,
    vendor: payload.vendor || '',
    parts_cost: parts,
    labor_cost: labor,
    total_cost: total,
    at: payload.at ? new Date(payload.at) : new Date(),
    by: userId,
  });
  ticket.internal_parts_cost = num(ticket.internal_parts_cost) + parts;
  ticket.internal_labor_cost = num(ticket.internal_labor_cost) + labor;
  await ticket.save();
  return mapTicket(ticket);
}

async function markReady(ticketId, payload, userId) {
  const ticket = await CustomerRepairTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Không tìm thấy phiếu');
    err.status = 404;
    throw err;
  }
  if (ticket.status !== 'dang_sua') {
    const err = new Error('Phiếu phải ở trạng thái đang sửa');
    err.status = 400;
    throw err;
  }

  if (payload.final_amount != null) ticket.final_amount = num(payload.final_amount);
  ticket.status = 'cho_tra';
  ticket.completed_at = new Date();
  pushRepairStatusHistory(ticket, 'cho_tra', payload.note || 'Sửa xong — chờ trả máy', userId);
  await ticket.save();

  const skipEmail = Boolean(payload.skipEmail);
  const emailResult = skipEmail
    ? { sent: false, skipped: true }
    : await sendRepairReadyEmail(ticket);
  if (emailResult.sent) {
    ticket.ready_email_sent_at = Date.now();
    await ticket.save();
  }

  return { ticket: mapTicket(ticket), emailResult };
}

async function markReturned(ticketId, payload, userId) {
  const ticket = await CustomerRepairTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Không tìm thấy phiếu');
    err.status = 404;
    throw err;
  }
  if (ticket.status !== 'cho_tra') {
    const err = new Error('Phiếu phải ở trạng thái chờ trả');
    err.status = 400;
    throw err;
  }

  if (payload.collected_amount != null) {
    ticket.final_amount = num(payload.collected_amount);
  }

  ticket.status = 'da_tra';
  ticket.returned_at = new Date();
  pushRepairStatusHistory(ticket, 'da_tra', payload.note || 'Đã trả máy cho khách', userId);
  await ticket.save();
  return mapTicket(ticket);
}

async function cancelTicket(ticketId, note, userId) {
  const ticket = await CustomerRepairTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Không tìm thấy phiếu');
    err.status = 404;
    throw err;
  }
  if (ticket.status === 'da_tra') {
    const err = new Error('Phiếu đã trả — không thể hủy');
    err.status = 400;
    throw err;
  }
  ticket.status = 'da_huy';
  pushRepairStatusHistory(ticket, 'da_huy', note || 'Hủy phiếu', userId);
  await ticket.save();
  return mapTicket(ticket);
}

async function getOpsSummary() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [tickets, monthReturned] = await Promise.all([
    CustomerRepairTicket.find({
      status: { $in: ['tiep_nhan', 'cho_khach_xac_nhan', 'dang_sua', 'cho_tra'] },
    }).lean(),
    CustomerRepairTicket.find({
      status: 'da_tra',
      returned_at: { $gte: monthStart },
    }).lean(),
  ]);

  const counts = {
    tiep_nhan: 0,
    cho_khach_xac_nhan: 0,
    dang_sua: 0,
    cho_tra: 0,
    da_tra_month: monthReturned.length,
    revenue_month: monthReturned.reduce((s, t) => s + num(t.final_amount || t.quote_amount), 0),
    cost_month: monthReturned.reduce(
      (s, t) => s + num(t.internal_parts_cost) + num(t.internal_labor_cost),
      0
    ),
  };

  for (const t of tickets) {
    if (counts[t.status] != null) counts[t.status] += 1;
  }

  counts.profit_month = counts.revenue_month - counts.cost_month;

  return { counts, pipeline: sortRepairTickets(tickets).slice(0, 12).map(mapTicket) };
}

module.exports = {
  listTickets,
  getTicketById,
  createTicket,
  sendQuote,
  confirmByToken,
  confirmAtCounter,
  addWorkLog,
  markReady,
  markReturned,
  cancelTicket,
  getOpsSummary,
  getFrontendBase,
  mapTicket,
};

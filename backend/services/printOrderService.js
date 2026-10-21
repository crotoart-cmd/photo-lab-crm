const PrintOrder = require('../models/PrintOrder');
const {
  PRINT_METHODS,
  PRINT_SOURCES,
  PRINT_SIZES,
  PRINT_PAPERS,
  PRINT_FILE_HANDOFF,
  PRINT_DELIVERY,
} = require('../data/printOrderOptions');

function pickEnum(options, value, fallback) {
  const allowed = options.map((o) => o.value);
  return allowed.includes(value) ? value : fallback;
}

function str(value, max = 400) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function clampPrintQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(40, Math.round(n));
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function generatePrintCode() {
  return `IN-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

function papersForMethod(method) {
  return method === 'optical' ? ['ilford', 'fuji'] : ['glossy', 'matte'];
}

function sourcesForMethod(method) {
  return method === 'optical' ? ['negative', 'lab_scan'] : ['files', 'lab_scan'];
}

async function createPrintOrder({ body, customer }) {
  const method = pickEnum(PRINT_METHODS, body.method, 'optical');
  const source = pickEnum(PRINT_SOURCES, body.source, method === 'inkjet' ? 'files' : 'negative');
  if (!sourcesForMethod(method).includes(source)) {
    const err = new Error('Nguồn ảnh không khớp kiểu in đã chọn');
    err.status = 400;
    throw err;
  }

  const paper = pickEnum(PRINT_PAPERS, body.paper, method === 'optical' ? 'ilford' : 'glossy');
  if (!papersForMethod(method).includes(paper)) {
    const err = new Error('Giấy in không khớp kiểu in đã chọn');
    err.status = 400;
    throw err;
  }

  const size = pickEnum(PRINT_SIZES, body.size, '13x18');
  const customSize = size === 'custom' ? str(body.customSize, 80) : '';
  if (size === 'custom' && !customSize) {
    const err = new Error('Ghi khổ in riêng');
    err.status = 400;
    throw err;
  }

  let fileHandoff = 'none';
  let fileLink = '';
  if (source === 'files') {
    fileHandoff = pickEnum(PRINT_FILE_HANDOFF, body.fileHandoff, 'link');
    fileLink = str(body.fileLink, 500);
    if (fileHandoff === 'link' && !isHttpUrl(fileLink)) {
      const err = new Error('Dán link Drive, Dropbox hoặc WeTransfer');
      err.status = 400;
      throw err;
    }
  }

  const delivery = pickEnum(PRINT_DELIVERY, body.delivery, 'pickup');
  const address = str(body.address, 400);
  if (delivery === 'ship' && !address) {
    const err = new Error('Ghi địa chỉ nhận hàng');
    err.status = 400;
    throw err;
  }

  const order = await PrintOrder.create({
    code: generatePrintCode(),
    customerId: customer._id,
    customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
    customer_phone: customer.phone,
    customer_email: customer.email,
    method,
    source,
    size,
    customSize,
    paper,
    quantity: clampPrintQty(body.quantity),
    fileHandoff,
    fileLink,
    delivery,
    address: delivery === 'ship' ? address : '',
    note: str(body.note, 800),
  });

  return order;
}

module.exports = { createPrintOrder };

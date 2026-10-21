const ScanOrder = require('../models/ScanOrder');
const {
  SCAN_METHODS,
  SCAN_SOURCES,
  SCAN_FORMATS,
  SCAN_SIZES,
  SCAN_OUTPUTS,
  SCAN_DELIVERY,
} = require('../data/scanOrderOptions');

function pickEnum(options, value, fallback) {
  const allowed = options.map((o) => o.value);
  return allowed.includes(value) ? value : fallback;
}

function str(value, max = 400) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function clampQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(20, Math.round(n));
}

function generateScanCode() {
  return `SC-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

async function createScanOrder({ body, customer }) {
  const method = pickEnum(SCAN_METHODS, body.method, 'batch');
  const source = pickEnum(SCAN_SOURCES, body.source, 'negative');
  const format = pickEnum(SCAN_FORMATS, body.format, '35mm');
  const scanSize = method === 'hiend' ? 'hiend' : pickEnum(SCAN_SIZES, body.scanSize, 'm');
  if (method === 'batch' && scanSize === 'hiend') {
    const err = new Error('Scan hàng loạt dùng size S / M / L');
    err.status = 400;
    throw err;
  }
  const output = pickEnum(SCAN_OUTPUTS, body.output, method === 'hiend' ? 'tiff' : 'jpeg');
  const delivery = pickEnum(SCAN_DELIVERY, body.delivery, 'pickup');
  const address = str(body.address, 400);
  if (delivery === 'ship' && !address) {
    const err = new Error('Ghi địa chỉ nhận negative');
    err.status = 400;
    throw err;
  }
  const ticketRef = str(body.ticketRef, 80);
  if (source === 'lab_roll' && !ticketRef) {
    const err = new Error('Ghi mã phiếu lab đang giữ cuộn');
    err.status = 400;
    throw err;
  }

  return ScanOrder.create({
    code: generateScanCode(),
    customerId: customer._id,
    customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
    customer_phone: customer.phone,
    customer_email: customer.email,
    method,
    source,
    format,
    scanSize,
    output,
    quantity: clampQty(body.quantity),
    ticketRef,
    delivery,
    address: delivery === 'ship' ? address : '',
    note: str(body.note, 800),
  });
}

module.exports = { createScanOrder };

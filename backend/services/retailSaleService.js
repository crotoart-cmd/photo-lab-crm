const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const CameraRepairEvent = require('../models/CameraRepairEvent');
const RetailSale = require('../models/RetailSale');
const Customer = require('../models/Customer');
const { sendRetailInvoiceEmail } = require('./emailService');
const { fullName, normalizeEmail } = require('../utils/customerNormalize');
const {
  computeTrueCost,
  isSaleBlocked,
  buildSaleMetadata,
  appendTimeline,
  num,
} = require('./cameraLifecycleService');

const formatVnd = (n) => `${Math.round(num(n)).toLocaleString('vi-VN')}đ`;

const floorViolation = (unitPrice, floorPrice) => {
  const offer = num(unitPrice);
  const floor = num(floorPrice);
  if (floor > 0 && offer < floor) {
    return `Không thể bán! Giá offer (${formatVnd(offer)}) thấp hơn ngưỡng giới hạn an toàn (${formatVnd(floor)}).`;
  }
  return null;
};

const saleCode = () => `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function receiptLineFromSale(sale) {
  const serial =
    sale.metadata?.serial_number ||
    sale.metadata?.camera_code ||
    (sale.product_group === 'film' ? sale.code : '—');
  return {
    name: sale.name || sale.code,
    serial: String(serial).toUpperCase(),
    quantity: sale.quantity || 1,
    price: sale.unit_price,
  };
}

/**
 * Kiểm tra một món có bán được không (chỉ đọc, không đổi tồn kho).
 * Dùng để tiền kiểm tra cả giỏ trước khi xuất kho tuần tự — tránh bán dở dang.
 */
async function assertRetailSaleItemSellable(body) {
  const { product_group, code, quantity = 1, unit_price, camera_id, sell_as_is } = body;
  const qty = Number(quantity || 1);
  const fail = (message, status = 400) => {
    const err = new Error(message);
    err.status = status;
    throw err;
  };

  if (!['film', 'battery', 'camera'].includes(product_group)) fail('Nhóm hàng không hợp lệ');
  if (qty <= 0) fail('Số lượng phải > 0');

  if (product_group === 'film') {
    const sku = String(code || '').toUpperCase();
    if (!sku) fail('Thiếu mã SKU film');
    const batches = await FilmStock.find({ sku_code: sku, quantity: { $gt: 0 } }).sort({ expiry_date: 1 });
    const totalQty = batches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    if (totalQty < qty) fail(`Tồn film không đủ. Còn ${totalQty} cuộn`);
    const ref = batches[0];
    const price = num(unit_price) || num(ref?.price);
    const floorMsg = floorViolation(price, ref?.floor_price);
    if (floorMsg) fail(floorMsg);
    return;
  }

  if (product_group === 'battery') {
    const sku = String(code || '').toUpperCase();
    const row = await BatteryStock.findOne({ sku_code: sku });
    if (!row) fail('Không tìm thấy mã pin', 404);
    if (Number(row.quantity) < qty) fail(`Tồn pin không đủ. Còn ${row.quantity}`);
    const price = num(unit_price) || num(row.price);
    const floorMsg = floorViolation(price, row.floor_price);
    if (floorMsg) fail(floorMsg);
    return;
  }

  const row = camera_id
    ? await CameraStock.findById(camera_id)
    : await CameraStock.findOne({ camera_code: String(code || '').toUpperCase() });
  if (!row) fail('Không tìm thấy mã máy ảnh', 404);
  const saleGate = isSaleBlocked(row, { sell_as_is: Boolean(sell_as_is) });
  if (saleGate.blocked) fail(saleGate.reason);
  const price = num(unit_price) || num(row.price);
  const trueCost = computeTrueCost(row);
  const effectiveFloor = Math.max(num(row.floor_price), trueCost);
  const floorMsg = floorViolation(price, effectiveFloor);
  if (floorMsg) fail(floorMsg);
  if (price < trueCost && !sell_as_is) {
    fail(`Giá bán (${formatVnd(price)}) thấp hơn vốn thực (${formatVnd(trueCost)} = mua + sửa)`);
  }
}

async function processRetailSaleItem(body, userId) {
  const {
    product_group,
    code,
    quantity = 1,
    unit_price,
    camera_id,
    note,
    customerId,
    buyerName,
    buyerEmail,
    sell_as_is,
  } = body;
  const qty = Number(quantity || 1);
  if (!['film', 'battery', 'camera'].includes(product_group)) {
    const err = new Error('Nhóm hàng không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (qty <= 0) {
    const err = new Error('Số lượng phải > 0');
    err.status = 400;
    throw err;
  }

  let itemName = '';
  let listPrice = 0;
  let usedPrice = num(unit_price);
  let totalCost = 0;
  const metadata = {};

  if (product_group === 'film') {
    const sku = String(code || '').toUpperCase();
    if (!sku) {
      const err = new Error('Thiếu mã SKU film');
      err.status = 400;
      throw err;
    }
    const batches = await FilmStock.find({ sku_code: sku, quantity: { $gt: 0 } }).sort({ expiry_date: 1 });
    const totalQty = batches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    if (totalQty < qty) {
      const err = new Error(`Tồn film không đủ. Còn ${totalQty} cuộn`);
      err.status = 400;
      throw err;
    }

    const ref = batches[0];
    listPrice = num(ref?.price);
    if (!usedPrice) usedPrice = listPrice;
    const floorMsg = floorViolation(usedPrice, ref?.floor_price);
    if (floorMsg) {
      const err = new Error(floorMsg);
      err.status = 400;
      throw err;
    }

    let left = qty;
    const consumed = [];
    for (const batch of batches) {
      if (left <= 0) break;
      const take = Math.min(Number(batch.quantity), left);
      batch.quantity -= take;
      batch.updatedAt = Date.now();
      await batch.save();
      left -= take;
      const batchCost =
        num(batch.cost) || num(batch.cost_history?.[batch.cost_history.length - 1]?.cost);
      totalCost += batchCost * take;
      consumed.push({
        batchId: batch._id,
        qty: take,
        expiry_date: batch.expiry_date,
        unit_cost: num(batch.cost),
      });
    }
    itemName = ref?.name || sku;
    metadata.fifo = consumed;
  }

  if (product_group === 'battery') {
    const sku = String(code || '').toUpperCase();
    const row = await BatteryStock.findOne({ sku_code: sku });
    if (!row) {
      const err = new Error('Không tìm thấy mã pin');
      err.status = 404;
      throw err;
    }
    if (Number(row.quantity) < qty) {
      const err = new Error(`Tồn pin không đủ. Còn ${row.quantity}`);
      err.status = 400;
      throw err;
    }
    listPrice = num(row.price);
    if (!usedPrice) usedPrice = listPrice;
    const floorMsg = floorViolation(usedPrice, row.floor_price);
    if (floorMsg) {
      const err = new Error(floorMsg);
      err.status = 400;
      throw err;
    }

    row.quantity -= qty;
    row.updatedAt = Date.now();
    await row.save();
    itemName = row.name;
    totalCost = num(row.cost) * qty;
  }

  if (product_group === 'camera') {
    const row = camera_id
      ? await CameraStock.findById(camera_id)
      : await CameraStock.findOne({ camera_code: String(code || '').toUpperCase() });
    if (!row) {
      const err = new Error('Không tìm thấy mã máy ảnh');
      err.status = 404;
      throw err;
    }

    const saleGate = isSaleBlocked(row, { sell_as_is: Boolean(sell_as_is) });
    if (saleGate.blocked) {
      const err = new Error(saleGate.reason);
      err.status = 400;
      throw err;
    }

    listPrice = num(row.price);
    if (!usedPrice) usedPrice = listPrice;

    const trueCost = computeTrueCost(row);
    const effectiveFloor = Math.max(num(row.floor_price), trueCost);
    const floorMsg = floorViolation(usedPrice, effectiveFloor);
    if (floorMsg) {
      const err = new Error(floorMsg);
      err.status = 400;
      throw err;
    }

    if (usedPrice < trueCost && !sell_as_is) {
      const err = new Error(
        `Giá bán (${formatVnd(usedPrice)}) thấp hơn vốn thực (${formatVnd(trueCost)} = mua + sửa)`
      );
      err.status = 400;
      throw err;
    }

    const repairs = await CameraRepairEvent.find({ camera_id: row._id }).select('_id').lean();
    const repairCount = repairs.length;

    row.status = 'Da_Ban';
    row.sold_at = Date.now();
    row.sold_price = usedPrice;
    row.sold_note = note || (saleGate.asIs ? 'Bán nguyên trạng (as-is)' : '');
    row.updatedAt = Date.now();
    appendTimeline(row, {
      type: 'sale',
      summary: `Đã bán ${formatVnd(usedPrice)} · vốn thực ${formatVnd(trueCost)}`,
      meta: { sold_price: usedPrice, true_cost: trueCost, as_is: Boolean(sell_as_is) },
    });
    await row.save();

    itemName = row.model_name;
    totalCost = trueCost;
    Object.assign(metadata, buildSaleMetadata(row.toObject(), repairs));
    metadata.sold_as_is = Boolean(sell_as_is);
  }

  const total = Number((usedPrice * qty).toFixed(2));
  const profit = Number((total - totalCost).toFixed(2));
  const sale = await RetailSale.create({
    sale_code: saleCode(),
    product_group,
    code,
    name: itemName || code,
    quantity: qty,
    list_price: listPrice,
    unit_price: usedPrice,
    unit_cost: qty > 0 ? Number((totalCost / qty).toFixed(2)) : 0,
    total_amount: total,
    total_cost: Number(totalCost.toFixed(2)),
    profit,
    customerId: customerId || undefined,
    buyerName: buyerName || undefined,
    buyerEmail: buyerEmail ? String(buyerEmail).trim().toLowerCase() : undefined,
    metadata,
    createdBy: userId,
  });

  return { sale, profit };
}

async function sendSaleReceiptEmail({ sales, customer_email, customer_name }) {
  let buyerEmail = normalizeEmail(customer_email);
  let buyerName = String(customer_name || '').trim();

  if (!buyerEmail && sales?.[0]?.customerId) {
    const customer = await Customer.findById(sales[0].customerId).select('email firstName lastName');
    if (customer?.email) buyerEmail = normalizeEmail(customer.email);
    if (!buyerName) buyerName = fullName(customer);
  }

  if (!buyerEmail || !sales?.length) return null;

  const lines = sales.map(receiptLineFromSale);
  const hasCamera = sales.some((s) => s.product_group === 'camera');
  const orderCode =
    sales.length === 1 ? sales[0].sale_code : `BATCH-${sales[0].sale_code}`;

  return sendRetailInvoiceEmail({
    to: buyerEmail,
    customerName: buyerName || 'Quý khách',
    orderCode,
    lines,
    includeWarranty: hasCamera,
  });
}

module.exports = {
  processRetailSaleItem,
  assertRetailSaleItemSellable,
  sendSaleReceiptEmail,
  receiptLineFromSale,
};

const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const CameraRepairEvent = require('../models/CameraRepairEvent');
const RetailSale = require('../models/RetailSale');
const Customer = require('../models/Customer');
const SiteContent = require('../models/SiteContent');
const { consumeFilmBatches } = require('./filmChannelStock');
const { reservedFor } = require('./shopReservations');
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

async function assertFree(source, ref, onHand, qty, unit, body) {
  const held = await reservedFor(source, ref, { excludeOrderId: body.shop_order_id });
  if (!held.qty) return;
  const free = Math.max(0, num(onHand) - held.qty);
  if (free >= qty) return;
  const err = new Error(
    source === 'camera'
      ? `Máy đang giữ cho đơn web ${held.codes.join(', ')} — xác nhận hoặc hủy đơn ở tab Đơn trước`
      : `Còn ${free} ${unit} bán được — ${held.qty} đang giữ cho đơn web ${held.codes.join(', ')}`
  );
  err.status = 409;
  throw err;
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

  if (!['film', 'battery', 'camera', 'merch'].includes(product_group)) fail('Nhóm hàng không hợp lệ');
  if (qty <= 0) fail('Số lượng phải > 0');

  if (product_group === 'film') {
    const sku = String(code || '').toUpperCase();
    if (!sku && !body.batch_id) fail('Thiếu mã SKU film');
    const batches = body.batch_id
      ? await FilmStock.find({ _id: body.batch_id })
      : await FilmStock.find({
          sku_code: sku,
          quantity: { $gt: 0 },
          ...(body.web_only ? { showOnWeb: true } : {}),
        }).sort({ expiry_date: 1 });
    const totalQty = batches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    if (totalQty < qty) {
      fail(`Tồn film${body.web_only ? ' (lô bật web)' : ''} không đủ. Còn ${totalQty} cuộn`);
    }
    const ref = batches[0];
    await assertFree('film', ref?.sku_code || sku, totalQty, qty, 'cuộn', body);
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
    await assertFree('battery', row._id, row.quantity, qty, 'pin', body);
    const price = num(unit_price) || num(row.price);
    const floorMsg = floorViolation(price, row.floor_price);
    if (floorMsg) fail(floorMsg);
    return;
  }

  if (product_group === 'merch') {
    const row = await SiteContent.findById(code);
    if (!row || row.type !== 'accessory') fail('Không tìm thấy merch', 404);
    const stock = row.quantity == null ? 1 : Number(row.quantity || 0);
    if (stock < qty) fail(`Tồn merch không đủ. Còn ${stock}`);
    await assertFree('merch', row._id, stock, qty, 'món', body);
    return;
  }

  const row = camera_id
    ? await CameraStock.findById(camera_id)
    : await CameraStock.findOne({ camera_code: String(code || '').toUpperCase() });
  if (!row) fail('Không tìm thấy mã máy ảnh', 404);
  const saleGate = isSaleBlocked(row, { sell_as_is: Boolean(sell_as_is) });
  if (saleGate.blocked) fail(saleGate.reason);
  await assertFree('camera', row._id, 1, 1, 'máy', body);
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
    batch_id,
    customerId,
    buyerName,
    buyerEmail,
    sell_as_is,
  } = body;
  const qty = Number(quantity || 1);
  const channel = body.channel === 'online' ? 'online' : 'counter';
  if (!['film', 'battery', 'camera', 'merch'].includes(product_group)) {
    const err = new Error('Nhóm hàng không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (qty <= 0) {
    const err = new Error('Số lượng phải > 0');
    err.status = 400;
    throw err;
  }

  await assertRetailSaleItemSellable(body);

  let itemName = '';
  let listPrice = 0;
  let usedPrice = num(unit_price);
  let totalCost = 0;
  const metadata = {};
  if (body.shop_order_code) metadata.shop_order = body.shop_order_code;

  if (product_group === 'film') {
    const sku = String(code || '').toUpperCase();
    if (!sku && !batch_id) {
      const err = new Error('Thiếu mã SKU film');
      err.status = 400;
      throw err;
    }
    const preview = batch_id
      ? await FilmStock.findById(batch_id)
      : await FilmStock.findOne({ sku_code: sku, quantity: { $gt: 0 } }).sort({ expiry_date: 1 });
    listPrice = num(preview?.price);
    if (!usedPrice) usedPrice = listPrice;
    const floorMsg = floorViolation(usedPrice, preview?.floor_price);
    if (floorMsg) {
      const err = new Error(floorMsg);
      err.status = 400;
      throw err;
    }
    const { ref, consumed, totalCost: filmCost } = await consumeFilmBatches({
      sku,
      qty,
      batchId: batch_id,
      webOnly: Boolean(body.web_only),
    });
    totalCost = filmCost;
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
    row.showOnWeb = false;
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

  if (product_group === 'merch') {
    const row = await SiteContent.findById(code);
    if (!row || row.type !== 'accessory') {
      const err = new Error('Không tìm thấy merch');
      err.status = 404;
      throw err;
    }
    const stock = row.quantity == null ? 1 : Number(row.quantity || 0);
    if (stock < qty) {
      const err = new Error(`Tồn merch không đủ. Còn ${stock}`);
      err.status = 400;
      throw err;
    }
    listPrice = num(row.price);
    if (!usedPrice) usedPrice = listPrice;
    row.quantity = stock - qty;
    await row.save();
    itemName = row.title;
    totalCost = 0;
  }

  metadata.channel = channel;

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
    channel,
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

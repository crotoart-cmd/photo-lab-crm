const ShopOrder = require('../models/ShopOrder');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const { findPublicCard } = require('./shopCatalog');
const { HOLD_MS, expireStaleOrders } = require('./shopReservations');
const { processRetailSaleItem, assertRetailSaleItemSellable } = require('./retailSaleService');

const orderCode = () =>
  `WEB-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function createShopOrder({ items, customer, delivery, address, note }) {
  const list = Array.isArray(items) ? items.slice(0, 10) : [];
  if (!list.length) fail('Chưa chọn món');

  const lines = [];
  for (const raw of list) {
    const qty = Math.max(1, Math.min(20, Math.round(Number(raw.quantity) || 1)));
    const cardRow = await findPublicCard(String(raw.source || ''), raw.id);
    if (!cardRow) fail('Món này không còn trên web');
    const take = cardRow.source === 'camera' ? 1 : qty;
    if (cardRow.free < take) {
      fail(cardRow.free ? `${cardRow.title}: chỉ còn ${cardRow.free}` : `${cardRow.title} đã hết hàng`, 409);
    }
    lines.push({
      source: cardRow.source,
      ref: cardRow.id,
      sku: cardRow.sku,
      serial: cardRow.serial,
      title: cardRow.title,
      quantity: take,
      price: cardRow.price,
    });
  }

  const ship = delivery === 'ship';
  if (ship && !String(address || '').trim()) fail('Cần địa chỉ giao hàng');

  return ShopOrder.create({
    code: orderCode(),
    items: lines,
    total: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    customerId: customer._id,
    customer_name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    customer_phone: customer.phone,
    customer_email: customer.email,
    delivery: ship ? 'ship' : 'pickup',
    address: ship ? String(address).trim().slice(0, 400) : '',
    note: String(note || '').trim().slice(0, 600),
    holdUntil: new Date(Date.now() + HOLD_MS),
  });
}

async function saleBodyFor(line, order) {
  const base = {
    quantity: line.quantity,
    unit_price: line.price,
    channel: 'online',
    customerId: order.customerId,
    buyerName: order.customer_name,
    buyerEmail: order.customer_email,
    shop_order_id: order._id,
    shop_order_code: order.code,
  };
  if (line.source === 'film') return { ...base, product_group: 'film', code: line.ref, web_only: true };
  if (line.source === 'merch') return { ...base, product_group: 'merch', code: line.ref };
  if (line.source === 'battery') {
    const row = await BatteryStock.findById(line.ref).select('sku_code').lean();
    if (!row) fail(`${line.title}: không còn trong kho`, 404);
    return { ...base, product_group: 'battery', code: row.sku_code };
  }
  const cam = await CameraStock.findById(line.ref).select('camera_code').lean();
  if (!cam) fail(`${line.title}: không còn trong kho`, 404);
  return { ...base, product_group: 'camera', camera_id: line.ref, code: cam.camera_code, quantity: 1 };
}

async function markShopOrderPaid(id, userId) {
  await expireStaleOrders();
  const order = await ShopOrder.findById(id);
  if (!order) fail('Không tìm thấy đơn', 404);
  if (order.status !== 'pending') fail('Đơn không còn chờ thanh toán');

  const bodies = [];
  for (const line of order.items) bodies.push(await saleBodyFor(line, order));
  for (const body of bodies) await assertRetailSaleItemSellable(body);

  const saleCodes = [];
  for (const body of bodies) {
    const { sale } = await processRetailSaleItem(body, userId);
    saleCodes.push(sale.sale_code);
  }
  order.status = 'paid';
  order.paidAt = new Date();
  order.saleCodes = saleCodes;
  order.handledBy = userId;
  await order.save();
  return order;
}

async function cancelShopOrder(id, userId, reason) {
  const order = await ShopOrder.findById(id);
  if (!order) fail('Không tìm thấy đơn', 404);
  if (order.status !== 'pending') fail('Đơn không còn chờ thanh toán');
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelReason = String(reason || '').trim().slice(0, 300) || 'Lab hủy';
  order.handledBy = userId;
  await order.save();
  return order;
}

async function listShopOrders({ limit = 60 } = {}) {
  await expireStaleOrders();
  const [pending, done] = await Promise.all([
    ShopOrder.find({ status: 'pending' }).sort({ createdAt: 1 }).lean(),
    ShopOrder.find({ status: { $ne: 'pending' } }).sort({ updatedAt: -1 }).limit(limit).lean(),
  ]);
  return { pending, done };
}

module.exports = {
  createShopOrder,
  markShopOrderPaid,
  cancelShopOrder,
  listShopOrders,
};

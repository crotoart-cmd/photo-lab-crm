const ShopOrder = require('../models/ShopOrder');

const HOLD_MS = 24 * 60 * 60 * 1000;

async function expireStaleOrders() {
  await ShopOrder.updateMany(
    { status: 'pending', holdUntil: { $lte: new Date() } },
    { $set: { status: 'expired', cancelledAt: new Date(), cancelReason: 'Quá 24 giờ chưa thanh toán' } }
  );
}

function reserveKey(source, ref) {
  const id = String(ref || '');
  return `${source}:${source === 'film' ? id.toUpperCase() : id}`;
}

/** Map key → { qty, codes[] } của đơn web đang giữ. */
async function reservedMap({ excludeOrderId } = {}) {
  await expireStaleOrders();
  const filter = { status: 'pending' };
  if (excludeOrderId) filter._id = { $ne: excludeOrderId };
  const orders = await ShopOrder.find(filter).select('code items').lean();
  const map = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      const key = reserveKey(item.source, item.ref);
      const cur = map.get(key) || { qty: 0, codes: [] };
      cur.qty += Number(item.quantity) || 0;
      if (!cur.codes.includes(order.code)) cur.codes.push(order.code);
      map.set(key, cur);
    }
  }
  return map;
}

async function reservedFor(source, ref, opts) {
  const map = await reservedMap(opts);
  return map.get(reserveKey(source, ref)) || { qty: 0, codes: [] };
}

module.exports = {
  HOLD_MS,
  expireStaleOrders,
  reserveKey,
  reservedMap,
  reservedFor,
};

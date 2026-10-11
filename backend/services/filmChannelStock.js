const FilmStock = require('../models/FilmStock');

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function daysLeft(expiry) {
  if (!expiry) return null;
  const end = new Date(expiry);
  end.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
}

/** FIFO theo hạn. webOnly: chỉ lấy lô đang bật Web (đơn online không nhận lô đã ẩn). */
async function consumeFilmBatches({ sku, qty, batchId, webOnly = false }) {
  const filter = batchId
    ? { _id: batchId }
    : { sku_code: String(sku || '').toUpperCase(), quantity: { $gt: 0 } };
  if (webOnly && !batchId) filter.showOnWeb = true;
  const batches = await FilmStock.find(filter).sort({ expiry_date: 1 });
  if (!batches.length) {
    const err = new Error(batchId ? 'Không tìm thấy lô film' : 'Không còn lô film phù hợp');
    err.status = batchId ? 404 : 400;
    throw err;
  }

  const total = batches.reduce((acc, batch) => acc + num(batch.quantity), 0);
  if (total < qty) {
    const err = new Error(`Tồn film không đủ. Còn ${total} cuộn`);
    err.status = 400;
    throw err;
  }

  let left = qty;
  let totalCost = 0;
  const consumed = [];
  let ref = null;

  for (const batch of batches) {
    if (left <= 0) break;
    const onHand = num(batch.quantity);
    if (onHand <= 0) continue;
    if (!ref) ref = batch;
    const take = Math.min(onHand, left);
    batch.quantity = onHand - take;
    batch.updatedAt = Date.now();
    await batch.save();
    left -= take;
    const batchCost = num(batch.cost) || num(batch.cost_history?.[batch.cost_history.length - 1]?.cost);
    totalCost += batchCost * take;
    consumed.push({
      batchId: batch._id,
      qty: take,
      expiry_date: batch.expiry_date,
      unit_cost: num(batch.cost),
    });
  }

  return { ref: ref || batches[0], consumed, totalCost };
}

module.exports = {
  num,
  daysLeft,
  consumeFilmBatches,
};

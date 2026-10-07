const RetailSale = require('../models/RetailSale');
const { DEMO_PREFIX, buildSampleRetailSales } = require('../data/sampleRetailSales');

/**
 * Nạp đơn bán lẻ demo cho biểu đồ Nhịp bán theo kỳ (upsert theo sale_code).
 */
async function ensureSampleRetailSales({ force = false } = {}) {
  const samples = buildSampleRetailSales();
  let created = 0;
  let skipped = 0;

  if (!force) {
    const existing = await RetailSale.countDocuments({
      sale_code: { $regex: `^${DEMO_PREFIX}` },
    });
    if (existing >= samples.length) {
      return { created: 0, skipped: samples.length, total: existing };
    }
  }

  for (const row of samples) {
    const found = await RetailSale.findOne({ sale_code: row.sale_code });
    if (found && !force) {
      skipped += 1;
      continue;
    }
    if (found && force) {
      await RetailSale.deleteOne({ _id: found._id });
    }

    await RetailSale.create(row);
    created += 1;
  }

  const total = await RetailSale.countDocuments({ sale_code: { $regex: `^${DEMO_PREFIX}` } });
  if (created > 0) {
    console.log(`✅ Đơn bán demo: thêm ${created} (tổng demo ${total})`);
  }

  return { created, skipped, total };
}

module.exports = { ensureSampleRetailSales };

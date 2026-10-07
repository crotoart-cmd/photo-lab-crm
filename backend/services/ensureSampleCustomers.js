const Customer = require('../models/Customer');
const SAMPLE_CUSTOMERS = require('../data/sampleCustomers');

/**
 * Tạo 14 khách mẫu nếu chưa có (theo email). An toàn khi gọi mỗi lần khởi động server.
 */
async function ensureSampleCustomers() {
  let created = 0;
  let updated = 0;

  for (const row of SAMPLE_CUSTOMERS) {
    const email = String(row.email).trim().toLowerCase();
    const existing = await Customer.findOne({ email });

    if (!existing) {
      await Customer.create({ ...row, email });
      created += 1;
      continue;
    }

    const patch = {};
    for (const key of ['firstName', 'lastName', 'phone', 'address', 'city', 'postalCode', 'notes']) {
      if (row[key] != null && row[key] !== '' && existing[key] !== row[key]) {
        patch[key] = row[key];
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = Date.now();
      await Customer.findByIdAndUpdate(existing._id, patch);
      updated += 1;
    }
  }

  const total = await Customer.countDocuments();
  if (created > 0) {
    console.log(`✅ Khách mẫu: thêm ${created} (tổng ${total} trong DB)`);
  } else if (updated > 0) {
    console.log(`ℹ️  Khách mẫu: cập nhật ${updated} bản ghi (tổng ${total})`);
  }

  return { created, updated, total };
}

module.exports = { ensureSampleCustomers, SAMPLE_CUSTOMERS };

/**
 * Nạp 10 máy ảnh test vào MongoDB.
 * Chạy: node scripts/seed-test-cameras.js (từ thư mục backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CameraStock = require('../models/CameraStock');
const samples = require('../data/test-cameras.json');

const connect = async () => {
  if (process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('✅ MongoDB (in-memory)');
    return mongod;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB:', process.env.MONGODB_URI);
  return null;
};

const seed = async () => {
  const mongod = await connect();
  let created = 0;
  let skipped = 0;

  for (const row of samples) {
    const serial = String(row.serial_number).toUpperCase();
    const exists = await CameraStock.findOne({
      $or: [{ serial_number: serial }, { camera_code: String(row.camera_code).toUpperCase() }],
    });
    if (exists) {
      console.log(`ℹ️  Bỏ qua (đã có): ${row.model_name} — ${serial}`);
      skipped += 1;
      continue;
    }

    await CameraStock.create({
      ...row,
      camera_code: String(row.camera_code).toUpperCase(),
      serial_number: serial,
      barcode: String(row.barcode || serial).toUpperCase(),
      status: 'San_Hang',
      cost_history: [{ cost: row.cost }],
    });
    console.log(`✅ ${row.model_name} — ${row.camera_code} — ${serial}`);
    created += 1;
  }

  const ready = await CameraStock.countDocuments({ status: 'San_Hang' });
  console.log(`\n🎉 Xong: thêm ${created}, bỏ qua ${skipped}. Tổng sẵn bán: ${ready}`);

  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

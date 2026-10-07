/**
 * Xuất HTML phiếu tiếp nhận (mở file trong trình duyệt để so với UI).
 * node scripts/preview-receipt-email.js [filmId]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Film = require('../models/Film');
const { buildFilmReceiptEmailHtml } = require('../templates/filmReceiptEmail');

const filmId = process.argv[2];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nuocleo-crm');
  let film;
  if (filmId) {
    film = await Film.findById(filmId).populate('customerId');
  } else {
    film = await Film.findOne().sort({ createdAt: -1 }).populate('customerId');
  }
  if (!film) {
    console.error('Không có phiếu film — tạo phiếu tiếp nhận trước');
    process.exit(1);
  }
  const html = buildFilmReceiptEmailHtml(film, film.customerId);
  const out = path.join(__dirname, '../tmp-receipt-preview.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
  console.log('✅ Đã ghi:', out);
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

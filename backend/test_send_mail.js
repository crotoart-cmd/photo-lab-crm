/**
 * Gửi thử khung email đẹp (cấu trúc order template) — dùng .env, không hardcode mật khẩu.
 * Chạy: node test_send_mail.js
 */
require('dotenv').config();
const { sendRetailInvoiceEmail } = require('./services/emailService');
const { brandSubject } = require('./services/emailBranding');

const to = process.env.TEST_EMAIL_TO || process.env.EMAIL_USER;

async function main() {
  const orderCode = `NL-${Math.floor(100000 + Math.random() * 900000)}`;

  const result = await sendRetailInvoiceEmail({
    to,
    customerName: 'Khách thử nghiệm',
    orderCode,
    lines: [
      { name: 'Máy ảnh Film Pentax K1000', serial: 'K1K-4501928', quantity: 1, price: 4800000 },
      { name: 'Cuộn film Ilford HP5 Plus 400 (135)', serial: '—', quantity: 2, price: 210000 },
    ],
    warrantyNote:
      'Thân máy bảo hành 06 tháng theo số sê-ri. Miễn phí 01 lần vệ sinh lăng kính trong 3 tháng đầu.',
  });

  if (result.sent) {
    console.log('🚀 Đã gửi mail mẫu:', brandSubject(`Hóa đơn - ${orderCode}`));
    console.log('📬 Kiểm tra:', to);
  } else {
    console.error('❌', result.error || 'SMTP chưa cấu hình');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

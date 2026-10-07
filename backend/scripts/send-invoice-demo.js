/**
 * Gửi hóa đơn mẫu — kiểm tra Gmail App Password.
 *
 * 1. Tạo App Password tại https://myaccount.google.com/apppasswords
 * 2. Dán 16 ký tự (liền, không cách) vào EMAIL_PASSWORD trong backend/.env
 * 3. Chạy: npm run test:invoice
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sendRetailInvoiceEmail, verifySmtp, normalizeAppPassword } = require('../services/emailService');

const to = process.argv[2] || process.env.TEST_EMAIL_TO || process.env.EMAIL_USER;

async function main() {
  const passLen = normalizeAppPassword(process.env.EMAIL_PASSWORD).length;
  if (!process.env.EMAIL_USER || passLen !== 16) {
    console.error('❌ Cấu hình .env: EMAIL_USER + EMAIL_PASSWORD (App Password đúng 16 ký tự)');
    process.exit(1);
  }

  const check = await verifySmtp();
  if (!check.ok) {
    console.error('❌ SMTP:', check.message);
    process.exit(1);
  }
  console.log('✅', check.message);

  const result = await sendRetailInvoiceEmail({
    to,
    customerName: 'Khách thử nghiệm',
    orderCode: 'CAM-202603-DEMO',
    lines: [
      {
        name: 'Máy ảnh Film Contax G2 + Lens 45mm f/2',
        serial: 'G2-184920',
        price: 32500000,
      },
      {
        name: 'Cuộn film Kodak Portra 400 (135)',
        serial: '—',
        price: 380000,
      },
    ],
    includeWarranty: true,
  });

  if (result.sent) {
    console.log('🚀 Đã gửi hóa đơn mẫu tới:', to);
  } else {
    console.error('❌ Gửi thất bại:', result.error || 'unknown');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

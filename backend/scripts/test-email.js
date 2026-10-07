/**
 * Gửi email thử — khung layout HDTLabx + logo.
 *   npm run test:email
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sendMail, normalizeAppPassword } = require('../services/emailService');
const { buildServiceNoticeEmail } = require('../templates/emailLayout');
const { brandSubject } = require('../services/emailBranding');

const to = process.argv[2] || process.env.TEST_EMAIL_TO || process.env.EMAIL_USER;
const passLen = normalizeAppPassword(process.env.EMAIL_PASSWORD).length;

if (!process.env.EMAIL_USER || passLen !== 16) {
  console.error('❌ Cấu hình EMAIL_USER + EMAIL_PASSWORD (App Password 16 ký tự)');
  process.exit(1);
}

async function run() {
  const html = buildServiceNoticeEmail({
    eyebrow: 'KIỂM TRA HỆ THỐNG EMAIL',
    customerName: 'Bạn',
    paragraphs: [
      'Nếu bạn thấy logo HDTLabx trên nền tối và khung trắng bên dưới, SMTP đã hoạt động.',
      `Gửi lúc ${new Date().toLocaleString('vi-VN')}.`,
    ],
  });

  const result = await sendMail({
    to,
    subject: brandSubject('Email thử nghiệm'),
    html,
  });

  if (result.sent) console.log('✅ Đã gửi tới:', to);
  else {
    console.error('❌', result.error || 'Lỗi');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});

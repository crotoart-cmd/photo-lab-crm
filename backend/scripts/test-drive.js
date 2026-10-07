/**
 * Kiểm tra cấu hình Google Drive (không upload thật nếu thiếu phiếu).
 * Usage: node scripts/test-drive.js
 */
require('dotenv').config();
const { getDriveStatus, isGoogleDriveConfigured } = require('../services/googleDriveService');

const status = getDriveStatus();
console.log('Google Drive status:', JSON.stringify(status, null, 2));

if (!isGoogleDriveConfigured()) {
  console.log('\n❌ Chưa sẵn sàng. Cần:');
  console.log('  - backend/credentials.json (Service Account key)');
  console.log('  - GOOGLE_DRIVE_PARENT_FOLDER_ID trong .env');
  console.log('  - Share folder Lab_Scan_Photos → Editor cho:', status.serviceAccountEmail || '(client_email trong JSON)');
  process.exit(1);
}

console.log('\n✅ Cấu hình Drive OK. Thử upload thật từ CRM: tải ảnh → Gửi link album.');

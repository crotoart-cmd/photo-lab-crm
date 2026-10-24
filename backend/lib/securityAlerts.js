const crypto = require('node:crypto');
const SecurityEvent = require('../models/SecurityEvent');
const emailService = require('../services/emailService');
const { brandSubject } = require('../services/emailBranding');
const { getAdminSiteUrl } = require('../config/hosts');
const { device } = require('./adminSessions');

const TITLES = {
  new_device: 'Đăng nhập từ thiết bị mới',
  password: 'Mật khẩu đăng nhập đã được đổi',
  email: 'Email đăng nhập đã được đổi',
  mfa_enable: 'Đã bật Google Authenticator',
  mfa_disable: 'Đã tắt Google Authenticator',
  mfa_recovery: 'Đã tạo mã dự phòng mới',
};
const pending = new Set();

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function deviceHash(req) {
  const { browser, platform } = device(req);
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`hdtlabx:device:v1:${browser}|${platform}`).digest('hex');
}

// A device counts as known after one successful sign-in within the 90-day audit window.
async function isNewDevice(userId, hash) {
  return !(await SecurityEvent.exists({ userId, event: { $in: ['login', 'mfa_login'] }, outcome: 'success', deviceHash: hash }));
}

function buildHtml(kind, req) {
  const { browser, platform } = device(req);
  const when = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
  const profile = `${getAdminSiteUrl()}/profile`;
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#1d1d1f">
  <h2 style="font-size:18px;margin:0 0 12px">${escape(TITLES[kind])}</h2>
  <p style="margin:0 0 4px">Thời gian: ${escape(when)} (giờ Việt Nam)</p>
  <p style="margin:0 0 16px">Thiết bị: ${escape(browser)} · ${escape(platform)}</p>
  <p style="margin:0 0 8px">Nếu đây là bạn, không cần làm gì thêm.</p>
  <p style="margin:0">Nếu không phải bạn: đổi mật khẩu ngay và đăng xuất các phiên khác tại
  <a href="${escape(profile)}">${escape(profile)}</a>.</p>
</div>`;
}

// Fire-and-forget: an alert must never block or fail the security action itself.
// The email carries no codes, tokens, passwords or IP addresses.
function notify(kind, recipients, req) {
  const to = [...new Set(recipients.filter(Boolean).map((r) => String(r).toLowerCase()))];
  if (!TITLES[kind] || !to.length) return;
  const html = buildHtml(kind, req);
  const send = Promise.all(to.map((address) => emailService.sendMail({ to: address, subject: brandSubject(TITLES[kind]), html })))
    .catch(() => console.warn('Security alert email could not be sent'))
    .finally(() => pending.delete(send));
  pending.add(send);
}

module.exports = { TITLES, deviceHash, isNewDevice, notify, flushAlerts: () => Promise.all([...pending]) };

/** Hệ thống tối đa 2 tài khoản: 1 owner + 1 staff (tùy chọn). */

const MAX_USERS = 2;

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'crotoart@gmail.com').toLowerCase();
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '123456';
const OWNER_NAME = process.env.OWNER_NAME || 'Crotoart Admin';

const isOwnerRole = (role) => role === 'owner' || role === 'admin';

module.exports = {
  MAX_USERS,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  OWNER_NAME,
  isOwnerRole,
};

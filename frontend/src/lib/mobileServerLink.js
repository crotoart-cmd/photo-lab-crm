/**
 * Liên kết backup tới Mac/server — điện thoại là nguồn dữ liệu chính.
 * JWT backup dùng riêng để đẩy hàng chờ lên server mà không phụ thuộc phiên máy.
 */
import api from '../api/client';

const BACKUP_JWT_KEY = 'nuocleo_server_jwt';

export const MSG_DEVICE_SAVED = 'Đã lưu trên máy';
export const MSG_BACKUP_PENDING = 'Sẽ backup lên Mac khi kết nối được server';
export const MSG_BACKUP_DONE = 'Đã backup lên server';
export const MSG_EMAIL_PENDING = 'Chưa gửi được email — thử lại khi kết nối Mac';

export function rememberServerJwt(token) {
  if (token && !String(token).startsWith('offline.')) {
    localStorage.setItem(BACKUP_JWT_KEY, token);
  }
}

export function clearBackupJwt() {
  localStorage.removeItem(BACKUP_JWT_KEY);
}

export function getBackupJwt() {
  const main = localStorage.getItem('token');
  if (main && !main.startsWith('offline.')) return main;
  return localStorage.getItem(BACKUP_JWT_KEY) || null;
}

export function hasBackupSession() {
  return Boolean(getBackupJwt());
}

/** Gọi API backup — không chặn thao tác trên máy nếu server không tới được. */
export async function backupApi(config) {
  const jwt = getBackupJwt();
  if (!jwt) return null;

  const headers = {
    ...(config.headers || {}),
    Authorization: `Bearer ${jwt}`,
  };

  return api({
    ...config,
    headers,
    timeout: config.timeout ?? 15000,
  });
}

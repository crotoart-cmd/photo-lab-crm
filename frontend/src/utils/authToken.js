import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { clearBackupJwt } from '../lib/mobileServerLink';

const BACKUP_JWT_KEY = 'nuocleo_server_jwt';

export function isOfflineToken(token) {
  return Boolean(token && String(token).startsWith('offline.'));
}

/** JWT server — trên mobile dùng backup JWT khi phiên chính là offline. */
export function getServerAuthToken() {
  const token = localStorage.getItem('token');
  if (token && !isOfflineToken(token)) return token;
  if (isMobileDataEnabled()) {
    return localStorage.getItem(BACKUP_JWT_KEY) || null;
  }
  return null;
}

export function isAuthError(err) {
  return err?.response?.status === 401;
}

/** Xóa JWT server hết hạn; giữ user local để tiếp tục offline */
export function clearStaleServerAuth() {
  const token = localStorage.getItem('token');
  if (token && !isOfflineToken(token)) {
    localStorage.removeItem('token');
    clearBackupJwt();
  }
}

export function authErrorMessage(err) {
  if (!isAuthError(err)) return null;
  if (isMobileDataEnabled()) {
    return 'Phiên Mac hết hạn — đang dùng dữ liệu trên máy. Đăng nhập lại khi cần đồng bộ.';
  }
  return 'Phiên đăng nhập hết hạn — vui lòng đăng nhập lại';
}

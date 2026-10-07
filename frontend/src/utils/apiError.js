/** Backend chưa chạy, URL sai (/api), hoặc router cũ (404). */
import { authErrorMessage } from './authToken';

export { isAuthError, authErrorMessage, getServerAuthToken, isOfflineToken, clearStaleServerAuth } from './authToken';
export function isApiRouteMissing(err) {
  if (err?.response?.status !== 404) return false;
  const path = err?.config?.url || '';
  if (String(path).includes('/retail/')) return true;
  const msg = String(err?.response?.data || '');
  return /cannot (get|post)/i.test(msg);
}

/** Gộp message + error từ API Express/Mongoose. */
export function apiErrorMessage(err, fallback = 'Yêu cầu thất bại') {
  const authMsg = authErrorMessage(err);
  if (authMsg) return authMsg;
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return 'Không tới được máy chủ backup — app vẫn dùng số liệu trên máy';
  }
  if (err?.code === 'ERR_NETWORK' || !err?.response) {
    return 'Không tới được máy chủ backup — app vẫn dùng số liệu trên máy';
  }
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  const msg = data.message || data.error;
  const detail = data.message && data.error && data.error !== data.message ? data.error : null;
  return detail ? `${data.message}: ${data.error}` : msg || fallback;
}

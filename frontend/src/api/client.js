import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { clearStaleServerAuth, getServerAuthToken } from '../utils/authToken';
import { isCrmHost } from '../config/siteHosts';
import { rememberServerJwt } from '../lib/mobileServerLink';
import { saveOfflineCredentials } from '../lib/mobileOfflineAuth';
import { adminActivityHeader, SESSION_DEADLINE_EVENT } from '../lib/adminSessionActivity';

const API_TIMEOUT_MS = isMobileDataEnabled() ? 8000 : 30000;

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

let csrfPromise;
let authGeneration = 0;
function isWebAdminRequest(config) {
  if (isMobileDataEnabled() || !isCrmHost()) return false;
  try { return new URL(config.url, new URL(config.baseURL || '/api', window.location.origin)).origin === window.location.origin; }
  catch { return false; }
}
function needsCsrf(config) {
  if (!isWebAdminRequest(config) || /^(get|head|options)$/i.test(config.method || 'get') || config.headers?.get?.('Authorization')) return false;
  const pathname = new URL(config.url, window.location.origin).pathname.replace(/^\/api(?=\/)/, '');
  return !/^\/(public|repair-public|delivery)(\/|$)/.test(pathname) && !/^\/auth\/(login|mfa\/login)\/?$/.test(pathname);
}
function readCsrf() {
  if (!csrfPromise) csrfPromise = api.get('/auth/csrf').then(({ data }) => {
    if (typeof data.csrfToken !== 'string') throw new Error('Không đọc được mã bảo mật phiên.');
    return data.csrfToken;
  }).catch((error) => { csrfPromise = undefined; throw error; });
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  config._authGeneration = authGeneration;
  config.baseURL = getApiBaseUrl();
  const token = getServerAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (isWebAdminRequest(config)) {
    config.headers['X-Client'] = 'web';
    config.headers['X-Session-Activity'] = adminActivityHeader();
  }
  if (needsCsrf(config)) config.headers['X-CSRF-Token'] = await readCsrf();
  return config;
});

api.interceptors.response.use(
  async (response) => {
    const rotates = /\/auth\/(login|logout|profile|mfa\/(login|enable|disable|recovery-codes))$/.test(response.config.url || '') && !response.data?.requiresMfa;
    if (rotates) { csrfPromise = undefined; authGeneration++; }
    const expiresAt = Date.parse(response.headers?.['x-session-expires-at']);
    const idleExpiresAt = Date.parse(response.headers?.['x-session-idle-expires-at']);
    if ((rotates || response.config._authGeneration === authGeneration) && isWebAdminRequest(response.config) && Number.isFinite(expiresAt) && Number.isFinite(idleExpiresAt) && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(SESSION_DEADLINE_EVENT, { detail: { expiresAt, idleExpiresAt } }));
    }
    if (isMobileDataEnabled() && response.data?.token && /\/auth\/(login|profile|mfa\/(login|enable|disable|recovery-codes))$/.test(response.config.url || '')) {
      localStorage.setItem('token', response.data.token);
      rememberServerJwt(response.data.token);
      if (/\/auth\/profile$/.test(response.config.url || '')) {
        const request = typeof response.config.data === 'string' ? JSON.parse(response.config.data) : response.config.data;
        if (request?.password && response.data.user) {
          try {
            await saveOfflineCredentials(response.data.user.email, request.password, response.data.user);
          } catch (_error) {
            localStorage.removeItem('hdtlabx_offline_cred');
          }
        }
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 403 && error.response.data?.code === 'CSRF_TOKEN_INVALID' &&
      error.config && !error.config._csrfRetried && !error.config.signal?.aborted && needsCsrf(error.config)) {
      if (error.config._authGeneration !== authGeneration) return Promise.reject(error);
      csrfPromise = undefined;
      error.config._csrfRetried = true;
      return api.request(error.config);
    }
    if (error.response?.status === 401) {
      if (isWebAdminRequest(error.config || {}) && Number.isInteger(error.config?._authGeneration) && error.config._authGeneration !== authGeneration) return Promise.reject(error);
      csrfPromise = undefined;
      clearStaleServerAuth();
      if (!isMobileDataEnabled() && isCrmHost()) {
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

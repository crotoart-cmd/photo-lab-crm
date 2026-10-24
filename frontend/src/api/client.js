import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { clearStaleServerAuth, getServerAuthToken } from '../utils/authToken';
import { isCrmHost } from '../config/siteHosts';
import { rememberServerJwt } from '../lib/mobileServerLink';
import { saveOfflineCredentials } from '../lib/mobileOfflineAuth';

const API_TIMEOUT_MS = isMobileDataEnabled() ? 8000 : 30000;

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = getServerAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  async (response) => {
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
  (error) => {
    if (error.response?.status === 401) {
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

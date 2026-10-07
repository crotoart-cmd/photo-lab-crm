import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { clearStaleServerAuth, getServerAuthToken } from '../utils/authToken';

const API_TIMEOUT_MS = isMobileDataEnabled() ? 8000 : 30000;

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
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
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStaleServerAuth();
      if (!isMobileDataEnabled()) {
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

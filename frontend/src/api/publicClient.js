import axios from 'axios';
import { getApiBaseUrl, isNativeApp } from '../config/apiBase';

const publicApi = axios.create({
  timeout: 30000,
});

publicApi.interceptors.request.use((config) => {
  // Browser public site stays on its own origin. localStorage API base is for the native app only.
  config.baseURL = isNativeApp() ? getApiBaseUrl() : (import.meta.env.VITE_API_URL || '/api');
  config.withCredentials = false;
  return config;
});

export default publicApi;

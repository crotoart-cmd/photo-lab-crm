import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase';

const publicApi = axios.create({
  timeout: 30000,
});

publicApi.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

export default publicApi;

const STORAGE_KEY = 'nuocleo_api_base';

function normalizeApiBase(url) {
  const trimmed = String(url || '').trim().replace(/\/$/, '');
  if (!trimmed) return '/api';
  if (trimmed === '/api') return trimmed;
  if (trimmed.startsWith('http') && !trimmed.endsWith('/api')) {
    return `${trimmed}/api`;
  }
  return trimmed;
}

export function getApiBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeApiBase(stored);
  const env = import.meta.env.VITE_API_URL;
  if (env) return normalizeApiBase(env);
  return '/api';
}

export function setApiBaseUrl(url) {
  const trimmed = String(url || '').trim().replace(/\/$/, '');
  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
}

export function isNativeApp() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

export function needsServerUrlSetup() {
  return isNativeApp() || import.meta.env.VITE_MOBILE_APP === 'true';
}

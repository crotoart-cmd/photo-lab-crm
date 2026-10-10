import { ADMIN_SITE_URL, SITE_URL } from './brand';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { isNativeApp } from './apiBase';

function hostnameNow() {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '')
    .split(':')[0]
    .toLowerCase();
}

/** CRM (login, dashboard, bán…) — admin subdomain, localhost, iOS app. */
export function isCrmHost() {
  if (isNativeApp() || isMobileDataEnabled()) return true;
  const h = hostnameNow();
  if (!h || h === 'localhost' || h === '127.0.0.1') return true;
  if (h === 'admin.hdtlabx.com') return true;
  if (h === 'hdtlabx.com' || h === 'www.hdtlabx.com') return false;
  return true;
}

export function adminAbsoluteUrl(pathAndQuery = '/') {
  const p = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const h = hostnameNow();
  if (!h || h === 'localhost' || h === '127.0.0.1') return p;
  const origin = String(ADMIN_SITE_URL || 'https://admin.hdtlabx.com').replace(/\/$/, '');
  return `${origin}${p}`;
}

export function publicAbsoluteUrl(pathAndQuery = '/') {
  const p = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const origin = String(SITE_URL || 'https://hdtlabx.com').replace(/\/$/, '');
  return `${origin}${p}`;
}

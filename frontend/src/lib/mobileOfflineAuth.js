/**
 * Xác thực offline trên iPhone — lưu hash mật khẩu sau đăng nhập online,
 * hoặc thiết lập lần đầu khi không tới được Mac (4G).
 */
import { isMobileDataEnabled } from './mobileLocalDb';

const CRED_KEY = 'nuocleo_offline_cred';
const PBKDF2_ITERATIONS = 120000;

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toBase64(bits);
}

export function readOfflineCredentials() {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveOfflineCredentials(email, password, user) {
  if (!isMobileDataEnabled()) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt);
  const payload = {
    email: String(email).trim().toLowerCase(),
    salt: toBase64(salt),
    hash,
    iterations: PBKDF2_ITERATIONS,
    user,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(CRED_KEY, JSON.stringify(payload));
}

async function verifyStoredPassword(email, password) {
  const stored = readOfflineCredentials();
  if (!stored) return null;
  const normalized = String(email).trim().toLowerCase();
  if (stored.email !== normalized) return null;
  const salt = fromBase64(stored.salt);
  const hash = await deriveKey(password, salt);
  if (hash !== stored.hash) return null;
  return stored;
}

function makeOfflineToken(email) {
  return `offline.${btoa(String(email).trim().toLowerCase())}`;
}

function makeLocalUser(email, existingUser) {
  if (existingUser) return existingUser;
  return {
    id: 'local-owner',
    name: 'Chủ hệ thống',
    email: String(email).trim().toLowerCase(),
    role: 'owner',
    phone: '',
    status: 'active',
  };
}

export function restoreOfflineSessionFromSavedUser() {
  const saved = localStorage.getItem('user');
  const creds = readOfflineCredentials();
  if (!saved || !creds) return null;
  try {
    const user = JSON.parse(saved);
    return { user, token: makeOfflineToken(creds.email) };
  } catch {
    return null;
  }
}

/** Đăng nhập bằng mật khẩu đã lưu trên máy. */
export async function verifyOfflineLogin(email, password) {
  if (!isMobileDataEnabled()) return null;
  const stored = await verifyStoredPassword(email, password);
  if (!stored) return null;
  const user = makeLocalUser(stored.email, stored.user);
  return { user, token: makeOfflineToken(stored.email) };
}

/**
 * Lần đầu không có server — lưu email/mật khẩu trên máy để dùng offline.
 * Chỉ khi chưa có creds hoặc cùng email.
 */
export async function bootstrapOfflineLogin(email, password) {
  if (!isMobileDataEnabled()) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized || String(password).length < 6) return null;

  const existing = readOfflineCredentials();
  if (existing && existing.email !== normalized) return null;

  const user = makeLocalUser(normalized, existing?.user);
  await saveOfflineCredentials(normalized, password, user);
  return { user, token: makeOfflineToken(normalized), firstSetup: !existing };
}

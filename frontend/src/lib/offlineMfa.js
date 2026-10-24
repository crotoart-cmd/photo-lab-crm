/** `mfa` khi đã bật 2FA. `unknown` khi máy chưa biết trạng thái. Cả hai không được vào offline. */
export function offlineMfaBlock(stored) {
  if (!stored) return null;
  if (stored.mfaEnabled === true || stored.user?.mfaEnabled === true) return 'mfa';
  if (stored.mfaEnabled !== false && stored.user?.mfaEnabled !== false) return 'unknown';
  return null;
}

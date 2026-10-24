let lastActivityAt = 0;
let reportedActivityAt = 0;
export const SESSION_DEADLINE_EVENT = 'hdtlabx:session-deadline';

export function hasRecentAdminActivity() {
  return lastActivityAt > 0 && Date.now() - lastActivityAt < 60000 &&
    (typeof document === 'undefined' || document.visibilityState !== 'hidden');
}

export function adminActivityHeader() {
  if (!hasRecentAdminActivity() || reportedActivityAt >= lastActivityAt) return '0';
  reportedActivityAt = lastActivityAt;
  return '1';
}

export function trackAdminActivity(onActivity) {
  const mark = () => {
    if (document.visibilityState === 'hidden') return;
    lastActivityAt = Date.now();
    onActivity();
  };
  const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  for (const event of events) window.addEventListener(event, mark, { passive: true, capture: true });
  document.addEventListener('visibilitychange', mark);
  lastActivityAt = Date.now();
  return () => {
    for (const event of events) window.removeEventListener(event, mark, true);
    document.removeEventListener('visibilitychange', mark);
    lastActivityAt = 0; reportedActivityAt = 0;
  };
}

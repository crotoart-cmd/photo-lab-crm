export const WEB_INBOX_PING_KEY = 'hdt_web_inbox_ping';
export const WEB_INBOX_CHANGED = 'hdt-web-inbox-changed';

export function pingWebInbox() {
  try {
    localStorage.setItem(WEB_INBOX_PING_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WEB_INBOX_CHANGED));
  }
}

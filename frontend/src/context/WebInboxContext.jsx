import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchWebInbox, subscribeWebInboxRefresh } from '../lib/webInbox';
import { useToast } from './ToastContext';

const EMPTY = { filmCount: 0, repairCount: 0, shopCount: 0, printCount: 0, scanCount: 0, total: 0, items: [] };
const WebInboxContext = createContext(null);

export function WebInboxProvider({ children }) {
  const { showToast } = useToast();
  const [inbox, setInbox] = useState(EMPTY);
  const prevTotal = useRef(null);

  const refresh = useCallback(async () => {
    const next = await fetchWebInbox();
    setInbox(next);
    if (prevTotal.current != null && next.total > prevTotal.current) {
      const added = next.total - prevTotal.current;
      showToast({
        variant: 'info',
        title: 'Đơn web mới',
        message: added === 1 ? 'Khách vừa gửi đơn trên website' : `${added} đơn mới từ website`,
        durationMs: 4000,
      });
    }
    prevTotal.current = next.total;
  }, [showToast]);

  useEffect(() => {
    refresh();
    return subscribeWebInboxRefresh(refresh);
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...inbox,
      badgeFor: (to) => {
        if (to === '/films' || String(to).startsWith('/films')) return inbox.filmCount;
        if (to === '/repairs' || String(to).startsWith('/repairs')) return inbox.repairCount;
        if (String(to).startsWith('/retail?tab=orders')) return inbox.shopCount || 0;
        return 0;
      },
      refresh,
    }),
    [inbox, refresh]
  );

  return <WebInboxContext.Provider value={value}>{children}</WebInboxContext.Provider>;
}

export function useWebInbox() {
  const ctx = useContext(WebInboxContext);
  if (!ctx) {
    return { ...EMPTY, badgeFor: () => 0, refresh: () => {} };
  }
  return ctx;
}

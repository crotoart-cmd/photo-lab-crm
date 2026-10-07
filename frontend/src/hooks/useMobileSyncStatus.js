import { useEffect, useState } from 'react';
import { getPendingSyncCount, isMobileDataEnabled } from '../lib/mobileLocalDb';
import { onSyncStatusChange } from '../lib/mobileSync';

export function useMobileSyncStatus() {
  const enabled = isMobileDataEnabled();
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pending, setPending] = useState(() => getPendingSyncCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const refreshPending = () => setPending(getPendingSyncCount());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsub = onSyncStatusChange((s) => {
      if (s.phase === 'start') setSyncing(true);
      if (s.phase === 'done') {
        setSyncing(false);
        setPending(s.remaining ?? getPendingSyncCount());
      }
    });

    const id = setInterval(refreshPending, 4000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsub();
      clearInterval(id);
    };
  }, [enabled]);

  const hasAttention = !online || pending > 0;

  return {
    enabled,
    online,
    pending,
    syncing,
    hasAttention,
    showInMenu: enabled && hasAttention,
  };
}

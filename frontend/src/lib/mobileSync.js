/**
 * Tự đồng bộ hàng chờ lên server khi có mạng (iPhone / app native).
 */
import {
  isMobileDataEnabled,
  getPendingSyncCount,
  getStorageSettings,
  pruneLocalData,
} from './mobileLocalDb';

let syncing = false;
let listeners = new Set();

export function onSyncStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(status) {
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      /* ignore */
    }
  });
}

export async function runAutoSync(reason = 'manual') {
  if (!isMobileDataEnabled()) return { ok: 0, fail: 0, remaining: 0, skipped: true };
  if (syncing) return { ok: 0, fail: 0, remaining: getPendingSyncCount(), skipped: true };

  syncing = true;
  notify({ phase: 'start', reason });

  try {
    let result = { ok: 0, fail: 0, remaining: getPendingSyncCount() };

    if (getPendingSyncCount() > 0) {
      const { syncPendingQueue } = await import('./mobileRetailBridge');
      result = await syncPendingQueue();
    }

    try {
      const { refreshDashboardFromServer } = await import('./mobileDashboardBridge');
      const { loadRetailData } = await import('./mobileRetailBridge');
      const { loadEnrichedCustomers } = await import('./mobileCustomerBridge');
      await refreshDashboardFromServer();
      await loadRetailData();
      await loadEnrichedCustomers();
    } catch {
      /* giữ cache local nếu server chưa reachable */
    }

    try {
      const { shouldRunAutoBackup, backupToServer } = await import('./mobileBackup');
      if (reason !== 'manual' && shouldRunAutoBackup()) {
        await backupToServer('auto');
      }
    } catch {
      /* backup tự động lỗi thì bỏ qua, không chặn sync */
    }

    notify({ phase: 'done', reason, ...result });
    return result;
  } finally {
    syncing = false;
  }
}

export function initMobileAutoSync() {
  if (!isMobileDataEnabled()) return () => {};

  const maybePrune = () => {
    const settings = getStorageSettings();
    if (!settings.autoPrune) return;
    try {
      pruneLocalData({ retentionMonths: settings.retentionMonths });
    } catch {
      /* ignore prune errors */
    }
  };

  const onOnline = () => {
    runAutoSync('online');
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') runAutoSync('visible');
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  let resumeHandle;
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (cap?.isNativePlatform?.() && cap.Plugins?.App?.addListener) {
    resumeHandle = cap.Plugins.App.addListener('resume', () => {
      maybePrune();
      runAutoSync('resume');
    });
  }

  // Dọn dữ liệu cũ nhẹ nhàng khi mở app.
  setTimeout(maybePrune, 300);
  // Thử đồng bộ ngay khi mở app
  setTimeout(() => runAutoSync('init'), 800);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    resumeHandle?.remove?.();
  };
}

export function isSyncing() {
  return syncing;
}

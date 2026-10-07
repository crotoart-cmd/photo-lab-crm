import { runAutoSync } from '../lib/mobileSync';
import { useMobileSyncStatus } from '../hooks/useMobileSyncStatus';

export default function MobileSyncMenuPanel() {
  const { showInMenu, online, pending, syncing } = useMobileSyncStatus();

  if (!showInMenu) return null;

  const label = !online
    ? pending > 0
      ? `Offline — ${pending} thao tác chờ trên máy`
      : 'Offline — dữ liệu lưu trên máy'
    : pending > 0
      ? `${pending} thao tác chờ đồng bộ server`
      : 'Đã đồng bộ';

  const hint = !online
    ? 'Tự đồng bộ khi có mạng / bấm Đồng bộ khi Mac online'
    : pending > 0
      ? 'Bấm để gửi dữ liệu lên Mac ngay'
      : 'Máy là nguồn chính — Mac chỉ backup';

  return (
    <div className="mobile-sync-menu-panel mx-3 mb-3">
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 ${
            online ? 'text-[var(--color-blue)]' : 'text-[var(--color-label-secondary)]'
          }`}
        >
          {online ? 'cloud_sync' : 'cloud_off'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-label)] leading-snug">{label}</p>
          <p className="text-xs text-[var(--color-label-secondary)] mt-0.5">{hint}</p>
          {pending > 0 && (
            <button
              type="button"
              disabled={syncing || !online}
              onClick={() => runAutoSync('menu')}
              className="apple-btn-primary w-full mt-3 text-sm !py-2"
            >
              {syncing ? 'Đang đồng bộ…' : online ? 'Đồng bộ ngay' : 'Chờ mạng để đồng bộ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

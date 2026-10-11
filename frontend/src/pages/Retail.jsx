import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api from '../api/client';
import { apiErrorMessage } from '../utils/apiError';
import {
  isMobileDataEnabled,
  getPendingSyncCount,
  syncPendingQueue,
  getRetailSnapshotInstant,
  refreshRetailDataInBackground,
} from '../lib/mobileRetailBridge';
import SmartIntakePanel from '../components/SmartIntakePanel';
import ShopOrdersPanel from '../components/retail/ShopOrdersPanel';
import { IosPage } from '../components/mobile';
import { IconIntake, IconSeeMore } from '../components/icons/tabBarIcons';
import { useWebInbox } from '../context/WebInboxContext';
import { ICON_SIZE } from '../components/icons/iconSizes';
import { useToast } from '../context/ToastContext';
import { RETAIL_DATA_CHANGED } from '../lib/seedTestCameras';
import {
  seedLocalTestDataBundle,
  formatTestDataSeedToast,
} from '../lib/seedLocalTestBundle';

const normalizeTab = (t) => {
  if (t === 'orders') return 'orders';
  return 'intake';
};

export default function Retail() {
  const mobileInitial = getRetailSnapshotInstant();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageTab, setPageTab] = useState(() => normalizeTab(searchParams.get('tab')));
  const shopBadge = useWebInbox().badgeFor('/retail?tab=orders');

  const setRetailTab = (tab) => {
    const id = normalizeTab(tab);
    setPageTab(id);
    navigate(`/retail?tab=${id}`, { replace: true });
    if (isMobileDataEnabled()) {
      const instant = getRetailSnapshotInstant();
      if (instant) applySnapshot(instant);
    }
  };
  const [summary, setSummary] = useState(mobileInitial?.summary ?? null);
  const { showToast, showError } = useToast();
  const [deviceMode, setDeviceMode] = useState(() => isMobileDataEnabled());
  const [pendingSync, setPendingSync] = useState(() => getPendingSyncCount());
  const [syncing, setSyncing] = useState(false);

  // —— Nhập kho ——
  const [filmRows, setFilmRows] = useState(mobileInitial?.filmRows ?? []);
  const [batteryRows, setBatteryRows] = useState(mobileInitial?.batteryRows ?? []);
  const [cameraRows, setCameraRows] = useState(mobileInitial?.cameraRows ?? []);

  const applySnapshot = useCallback((snap) => {
    setSummary(snap.summary);
    setFilmRows(snap.filmRows ?? []);
    setBatteryRows(snap.batteryRows ?? []);
    setCameraRows(snap.cameraRows ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setDeviceMode(isMobileDataEnabled());
    setPendingSync(getPendingSyncCount());

    if (isMobileDataEnabled()) {
      const instant = getRetailSnapshotInstant();
      if (instant) applySnapshot(instant);
      const updated = await refreshRetailDataInBackground();
      if (updated) applySnapshot(updated);
      return updated || instant;
    }

    const [sumRes, filmRes, batRes, camRes] = await Promise.all([
      api.get('/retail/summary'),
      api.get('/retail/film-stock'),
      api.get('/retail/battery-stock'),
      api.get('/retail/camera-stock'),
    ]);
    setSummary(sumRes.data);
    setFilmRows(filmRes.data);
    setBatteryRows(batRes.data);
    setCameraRows(camRes.data);
    return null;
  }, [applySnapshot]);

  useEffect(() => {
    if (isMobileDataEnabled()) {
      refreshRetailDataInBackground()
        .then((updated) => {
          if (updated) applySnapshot(updated);
        })
        .catch(() => {});
      return;
    }

    refresh().catch((err) => {
        if (isMobileDataEnabled()) {
          return;
        }
        if (err.response?.status === 404) {
          showError(
            'API bán lẻ chưa có trên server — khởi động lại backend: cd backend && npm start (port 5001).'
          );
        } else {
          showError(apiErrorMessage(err, 'Không tải được dữ liệu bán lẻ — kiểm tra backend đang chạy.'));
        }
      });
  }, [refresh]);

  useEffect(() => {
    const onRetailDataChanged = () => {
      const instant = getRetailSnapshotInstant();
      if (instant) applySnapshot(instant);
    };
    window.addEventListener(RETAIL_DATA_CHANGED, onRetailDataChanged);
    return () => window.removeEventListener(RETAIL_DATA_CHANGED, onRetailDataChanged);
  }, [applySnapshot]);

  const handleSeedTestCameras = useCallback(() => {
    const result = seedLocalTestDataBundle();
    const instant = getRetailSnapshotInstant();
    if (instant) applySnapshot(instant);
    showToast(formatTestDataSeedToast(result));
  }, [applySnapshot, showToast]);

  const handleSyncQueue = async () => {
    setSyncing(true);
    try {
      const { ok, fail, remaining } = await syncPendingQueue();
      setPendingSync(remaining);
      if (ok > 0) await refresh();
      showToast(
        remaining > 0
          ? `Đã đồng bộ — còn ${remaining} mục chờ`
          : ok > 0
            ? `Đã đồng bộ ${ok} mục lên server`
            : 'Không có gì cần đồng bộ'
      );
    } catch (err) {
      showError(apiErrorMessage(err, 'Đồng bộ thất bại'));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const tab = normalizeTab(searchParams.get('tab'));
    setPageTab(tab);
    if (searchParams.get('tab') !== tab) {
      navigate(`/retail?tab=${tab}`, { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <IosPage>
    <div className="retail-page">
      <div className="hidden">
        <PageHeader title="Shop Products" />
      </div>

      {deviceMode && pendingSync > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncQueue}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[14px]">cloud_sync</span>
            {syncing ? 'Đang đồng bộ…' : `Chờ đồng bộ: ${pendingSync}`}
          </button>
        </div>
      )}

      {summary && (
        <div className="retail-summary-grid mb-4 md:mb-6 hidden">
          <div className="retail-stat-pill">
            <p>Lô film</p>
            <p className="text-[var(--color-label)]">{summary.filmBatches}</p>
          </div>
          <div className="retail-stat-pill">
            <p>SKU pin</p>
            <p className="text-[var(--color-label)]">{summary.batterySkus}</p>
          </div>
          <div className="retail-stat-pill">
            <p>Máy sẵn hàng</p>
            <p className="text-[var(--color-green)]">{summary.cameraReady}</p>
          </div>
          {(summary.cameraWaiting > 0 || summary.cameraInRepair > 0) && (
            <>
              <div className="retail-stat-pill">
                <p>Chờ sửa</p>
                <p className="text-[var(--color-orange)]">{summary.cameraWaiting ?? 0}</p>
              </div>
              <div className="retail-stat-pill">
                <p>Đang sửa</p>
                <p className="text-[var(--color-blue)]">{summary.cameraInRepair ?? 0}</p>
              </div>
            </>
          )}
          <div className="retail-stat-pill">
            <p>Máy đã bán</p>
            <p className="text-[var(--color-label-secondary)]">{summary.cameraSold}</p>
          </div>
        </div>
      )}

      <div
        className="dashboard-segment-group dashboard-segment-group--row mb-4"
        role="tablist"
        aria-label="Shop Products"
      >
        {[
          { id: 'intake', label: 'Kho', Icon: IconIntake },
          { id: 'orders', label: 'Đơn', Icon: IconSeeMore, badge: shopBadge },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={pageTab === t.id}
            onClick={() => setRetailTab(t.id)}
            className={`dashboard-segment-btn gap-2 ${
              pageTab === t.id ? 'dashboard-segment-btn--active' : ''
            }`}
          >
            <t.Icon size={ICON_SIZE.toolbar} className="shrink-0" aria-hidden />
            {t.label}
            {t.badge ? <span className="retail-tab-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {pageTab === 'orders' && (
        <ShopOrdersPanel
          focusId={searchParams.get('id') || ''}
          onError={showError}
          onSuccess={showToast}
          onChanged={refresh}
        />
      )}

      {pageTab === 'intake' && (
        <div className="retail-intake-page">
          <SmartIntakePanel
            filmRows={filmRows}
            batteryRows={batteryRows}
            cameraRows={cameraRows}
            onSeedTestCameras={deviceMode ? handleSeedTestCameras : undefined}
            onSaved={refresh}
            onError={showError}
            onSuccess={showToast}
          />
        </div>
      )}
    </div>
    </IosPage>
  );
}

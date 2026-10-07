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
import SmartSalePanel from '../components/SmartSalePanel';
import { IosPage } from '../components/mobile';
import { IconIntake, IconSale } from '../components/icons/tabBarIcons';
import { ICON_SIZE } from '../components/icons/iconSizes';
import { useToast } from '../context/ToastContext';
import { RETAIL_DATA_CHANGED } from '../lib/seedTestCameras';
import {
  seedLocalTestDataBundle,
  formatTestDataSeedToast,
} from '../lib/seedLocalTestBundle';

const normalizeTab = (t) => {
  if (!t || t === 'pos' || t === 'sale') return 'sale';
  if (t === 'smart' || t === 'stock') return 'intake';
  return t === 'intake' ? 'intake' : 'sale';
};

const normalizeIntakeGroup = (g) =>
  ['camera', 'film', 'battery'].includes(g) ? g : 'camera';

export default function Retail() {
  const mobileInitial = getRetailSnapshotInstant();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageTab, setPageTab] = useState(() => normalizeTab(searchParams.get('tab')));

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

  const [filmSkus, setFilmSkus] = useState(mobileInitial?.filmSkus ?? []);
  const [batteries, setBatteries] = useState(mobileInitial?.batteries ?? []);
  const [cameras, setCameras] = useState(mobileInitial?.cameras ?? []);

  // —— Nhập kho ——
  const [filmRows, setFilmRows] = useState(mobileInitial?.filmRows ?? []);
  const [batteryRows, setBatteryRows] = useState(mobileInitial?.batteryRows ?? []);
  const [cameraRows, setCameraRows] = useState(mobileInitial?.cameraRows ?? []);

  const loadCatalog = useCallback(async () => {
    const [skuRes, batRes, camRes] = await Promise.all([
      api.get('/retail/film-sku'),
      api.get('/retail/battery-stock'),
      api.get('/retail/camera-stock', { params: { status: 'San_Hang' } }),
    ]);
    setFilmSkus(skuRes.data);
    setBatteries(batRes.data.filter((b) => b.quantity > 0));
    setCameras(camRes.data);
  }, []);

  const applySnapshot = useCallback((snap) => {
    setSummary(snap.summary);
    setFilmRows(snap.filmRows ?? []);
    setBatteryRows(snap.batteryRows ?? []);
    setCameraRows(snap.cameraRows ?? []);
    setFilmSkus(snap.filmSkus ?? []);
    setBatteries(snap.batteries ?? []);
    setCameras(snap.cameras ?? []);
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
    await loadCatalog();
    return null;
  }, [loadCatalog, applySnapshot]);

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
    setPageTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams]);

  return (
    <IosPage>
    <div className="retail-page">
      <div className={pageTab === 'sale' || pageTab === 'intake' ? 'hidden' : ''}>
        <PageHeader
          title="Kho & bán lẻ"
          subtitle={
            pageTab === 'sale' || pageTab === 'intake'
              ? undefined
              : 'Quét mã · AI Vision · giá nhập → niêm yết → sàn'
          }
        />
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
        <div className={`retail-summary-grid mb-4 md:mb-6 ${pageTab === 'sale' || pageTab === 'intake' ? 'hidden' : ''}`}>
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
        className="dashboard-segment-group dashboard-segment-group--row mb-4 desktop-shell-only desktop-shell-flex"
        role="tablist"
        aria-label="Chế độ kho & bán"
      >
        {[
          { id: 'sale', label: 'Bán hàng', Icon: IconSale },
          { id: 'intake', label: 'Nhập hàng', Icon: IconIntake },
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
          </button>
        ))}
      </div>

      {pageTab === 'sale' && (
        <div className="space-y-3 md:space-y-6">
          <SmartSalePanel
            stockSummary={
              summary
                ? { ready: summary.cameraReady, sold: summary.cameraSold }
                : null
            }
            readyCameras={cameras}
            filmSkus={filmSkus}
            batteries={batteries}
            onSeedTestCameras={deviceMode ? handleSeedTestCameras : undefined}
            onCheckoutDone={refresh}
            onError={showError}
            onSuccess={showToast}
          />
        </div>
      )}

      {pageTab === 'intake' && (
        <div className="retail-intake-page">
          <SmartIntakePanel
            defaultGroup={normalizeIntakeGroup(searchParams.get('group'))}
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

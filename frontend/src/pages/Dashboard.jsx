import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import LoadingIndicator from '../components/LoadingIndicator';
import RefreshButton from '../components/RefreshButton';
import FeedbackBanner from '../components/FeedbackBanner';
import { IosPage } from '../components/mobile';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { apiErrorMessage, isAuthError } from '../utils/apiError';
import {
  fetchDashboardAnalytics,
  fetchRepairOpsMarket,
  bootstrapMobileDashboard,
  getDashboardLocalSnapshot,
  refreshDashboardInBackground,
  buildLocalDayAnalytics,
  mergeLocalRetailIntoToday,
  mergeLocalDayAnalytics,
  withCachedMarket,
} from '../lib/mobileDashboardBridge';
import { needsServerUrlSetup } from '../config/apiBase';
import ServerUrlField from '../components/ServerUrlField';
import {
  SalesPerformancePanel,
  SalesRhythmPanel,
  InventorySupplyPanel,
  CustomerAnalyticsPanel,
  RepairOpsPanel,
} from '../components/dashboard/DashboardAnalyticsPanels';
import CounterBar from '../components/dashboard/CounterBar';
import { formatVnd } from '../utils/formatMoney';
import StoreOverviewPanel from '../components/dashboard/StoreOverviewPanel';
import LabFilmCharts from '../components/dashboard/LabFilmCharts';
import PeriodRangeSelect from '../components/dashboard/PeriodRangeSelect';
import { toAnalyticsParams } from '../utils/periodRange';

const INVENTORY_CATEGORY_LABELS = {
  chemical: 'Hóa chất/Thuốc tráng',
  film: 'Cuộn film',
  camera: 'Máy ảnh & phụ kiện',
  supplies: 'Vật tư khác',
};

const FILM_STATUS_LABELS = {
  received: 'Tiếp nhận',
  processing: 'Đang tráng',
  completed: 'Hoàn thành',
  delivered: 'Đã trả',
};

const FILM_STATUS_ORDER = ['received', 'processing', 'completed', 'delivered'];

const MAIN_TABS = [
  { id: 'store', label: 'Dashboard', icon: 'dashboard' },
  { id: 'sales', label: 'Hiệu suất KD', icon: 'payments' },
  { id: 'lab', label: 'Lab film', icon: 'precision_manufacturing' },
  { id: 'inventory', label: 'Kho & cung ứng', icon: 'inventory_2' },
  { id: 'customers', label: 'Khách hàng', icon: 'groups' },
];

/** Mobile — bỏ Kho & Hiệu suất KD (gộp vào Dashboard) */
const MOBILE_MAIN_TABS = MAIN_TABS.filter((tab) => !['inventory', 'sales'].includes(tab.id));

function PeriodAnalysisBlock({ title, subtitle, periodSelection, onPeriodChange, children, className = '' }) {
  return (
    <section className={`dashboard-period-block apple-card ${className}`.trim()}>
      <header className="dashboard-period-block__head">
        <div className="dashboard-period-block__intro">
          <h2 className="dashboard-period-block__title">{title}</h2>
          {subtitle ? <p className="dashboard-period-block__subtitle">{subtitle}</p> : null}
        </div>
        <PeriodRangeSelect value={periodSelection} onChange={onPeriodChange} />
      </header>
      <div className="dashboard-period-block__body">{children}</div>
    </section>
  );
}

function PeriodSection({ title, children }) {
  return (
    <div className="dashboard-period-block__section">
      {title ? <h3 className="dashboard-period-block__section-title">{title}</h3> : null}
      {children}
    </div>
  );
}

const DASHBOARD_PAGE_CLASS =
  'dashboard-page max-w-[1024px] mx-auto w-full min-h-[480px] md:ios-page-card md:bg-white md:rounded-2xl md:border md:border-[var(--color-separator)] md:shadow-sm md:p-5 lg:p-6';

function getRetailSnapshot(data) {
  const r = data?.retail || data?._localRetail;
  if (!r) {
    return {
      salesToday: 0,
      revenueToday: 0,
      cameraReady: 0,
      filmBatches: 0,
      batterySkus: 0,
      recentSales: [],
    };
  }
  return {
    salesToday: r.salesToday ?? 0,
    revenueToday: r.revenueToday ?? 0,
    cameraReady: r.cameraReady ?? 0,
    filmBatches: r.filmBatches ?? 0,
    batterySkus: r.batterySkus ?? 0,
    recentSales: r.recentSales ?? [],
  };
}

function hasFilmLabActivity(films) {
  if (!films) return false;
  return (
    (films.readyForPickup ?? 0) > 0 ||
    (films.waitingPickup ?? 0) > 0 ||
    (films.processing ?? 0) > 0 ||
    (films.receivedToday ?? 0) > 0
  );
}

function StatusBreakdownChart({ breakdown }) {
  const rows = FILM_STATUS_ORDER.map((key) => ({
    key,
    label: FILM_STATUS_LABELS[key] || key,
    count: breakdown?.[key] || 0,
  })).filter((row) => row.count > 0);

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return <p className="text-sm text-[var(--color-label-secondary)]">Chưa có phiếu film trong tháng này.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct = Math.round((row.count / total) * 100);
        return (
          <li key={row.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-label-secondary)]">{row.label}</span>
              <span className="font-medium text-[var(--color-label)]">
                {row.count} <span className="text-[var(--color-label-tertiary)]">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-fill-secondary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-blue)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function readMobileDashboardState(periodSelection = { id: 'month' }) {
  const snap = bootstrapMobileDashboard(periodSelection);
  if (!snap?.today) return null;
  return {
    data: snap.today,
    monthly: snap.monthly,
    analytics: snap.analytics,
    dataSource: snap.source,
    updatedAt: snap.cachedAt ? new Date(snap.cachedAt) : new Date(),
    error: '',
  };
}

export default function Dashboard() {
  const useMobileBridge = isMobileDataEnabled();
  const mobileInitial = useMobileBridge ? readMobileDashboardState({ id: 'month' }) : null;
  const [data, setData] = useState(() => mobileInitial?.data ?? (useMobileBridge ? bootstrapMobileDashboard({ id: 'month' }).today : null));
  const [monthly, setMonthly] = useState(mobileInitial?.monthly ?? null);
  const [analytics, setAnalytics] = useState(mobileInitial?.analytics ?? null);
  const [dayAnalytics, setDayAnalytics] = useState(() => {
    if (!useMobileBridge) return null;
    const snap = getDashboardLocalSnapshot({ id: 'day' });
    return mergeLocalDayAnalytics(snap?.analytics);
  });
  const [dayAnalyticsLoading, setDayAnalyticsLoading] = useState(false);
  const [error, setError] = useState(mobileInitial?.error ?? '');
  const [activeTab, setActiveTab] = useState('store');
  const [opsSubTab, setOpsSubTab] = useState('today');
  const [periodSelection, setPeriodSelection] = useState({ id: 'month' });
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(mobileInitial?.updatedAt ?? null);
  const [, setDataSource] = useState(mobileInitial?.dataSource ?? 'server');

  useEffect(() => {
    if (!data?.date && !updatedAt) return;
    try {
      localStorage.setItem(
        'nuocleo.dashboard.displayMeta',
        JSON.stringify({
          date: data?.date || new Date().toISOString().slice(0, 10),
          updatedAt: updatedAt?.toISOString?.() || null,
        })
      );
    } catch {
      // Metadata hiển thị không được làm gián đoạn Dashboard.
    }
  }, [data?.date, updatedAt]);

  const loadAnalytics = useCallback(async (selection) => {
    const sel = selection || { id: 'month' };
    if (useMobileBridge) {
      const local = bootstrapMobileDashboard(sel);
      if (local?.analytics) setAnalytics(withCachedMarket(local.analytics));
    }
    setAnalyticsLoading(true);
    try {
      if (useMobileBridge) {
        const [res, repairMarket] = await Promise.all([
          fetchDashboardAnalytics(sel),
          fetchRepairOpsMarket().catch(() => null),
        ]);
        let next = res.data ? withCachedMarket(res.data) : null;
        if (repairMarket) {
          next = next
            ? { ...next, market: { ...(next.market || {}), ...repairMarket } }
            : { period: sel.id, chartPeriod: sel.id, sales: {}, market: repairMarket };
        }
        if (next) setAnalytics(next);
      } else {
        const res = await api.get('/dashboard/analytics', { params: toAnalyticsParams(sel) });
        setAnalytics(res.data);
      }
    } catch (err) {
      if (!(useMobileBridge && isAuthError(err))) {
        setError(apiErrorMessage(err, 'Không tải được phân tích'));
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }, [useMobileBridge]);

  const loadDayAnalytics = useCallback(async () => {
    if (useMobileBridge) {
      setDayAnalytics(mergeLocalDayAnalytics(getDashboardLocalSnapshot({ id: 'day' })?.analytics));
    }
    setDayAnalyticsLoading(true);
    try {
      if (useMobileBridge) {
        const res = await fetchDashboardAnalytics('day');
        setDayAnalytics(mergeLocalDayAnalytics(res.data));
      } else {
        const res = await api.get('/dashboard/analytics', { params: { period: 'day' } });
        setDayAnalytics(res.data);
      }
    } catch (err) {
      if (useMobileBridge) {
        setDayAnalytics(mergeLocalDayAnalytics(null));
      } else if (!isAuthError(err)) {
        setError((prev) => prev || apiErrorMessage(err, 'Không tải được biểu đồ hôm nay'));
      }
    } finally {
      setDayAnalyticsLoading(false);
    }
  }, [useMobileBridge]);

  const applyDashboardSnapshot = useCallback((snap, source = snap?.source) => {
    if (!snap) return;
    setData(mergeLocalRetailIntoToday(snap.today));
    setMonthly(snap.monthly);
    if (snap.analytics) setAnalytics(withCachedMarket(snap.analytics));
    if (source) setDataSource(source);
    setError('');
    setUpdatedAt(snap.cachedAt ? new Date(snap.cachedAt) : new Date());
  }, []);

  const loadDashboard = useCallback(async (withAnalytics = true) => {
    setRefreshing(true);
    try {
      if (useMobileBridge) {
        const updated = await refreshDashboardInBackground(withAnalytics ? periodSelection : { id: 'month' });
        if (updated) {
          applyDashboardSnapshot(updated, 'server');
          setError('');
        } else {
          applyDashboardSnapshot(bootstrapMobileDashboard(periodSelection));
        }
        await loadDayAnalytics();
      } else {
        const requests = [api.get('/dashboard/today'), api.get('/dashboard/monthly')];
        if (withAnalytics) {
          requests.push(api.get('/dashboard/analytics', { params: toAnalyticsParams(periodSelection) }));
        }
        const results = await Promise.allSettled(requests);

        const todayRes = results[0];
        const monthlyRes = results[1];
        if (todayRes.status === 'fulfilled') {
          setData(todayRes.value.data);
        }
        if (monthlyRes.status === 'fulfilled') {
          setMonthly(monthlyRes.value.data);
        }
        if (withAnalytics && results[2]?.status === 'fulfilled') {
          setAnalytics(results[2].value.data);
        }

        const failed = results.find((r) => r.status === 'rejected');
        if (failed && todayRes.status !== 'fulfilled') {
          throw failed.reason;
        }
        if (failed) {
          setError(
            apiErrorMessage(failed.reason, 'Một phần dữ liệu chưa tải được — thử làm mới')
          );
        } else {
          setError('');
        }
        setDataSource('server');
        setUpdatedAt(new Date());
      }
    } catch (err) {
      if (useMobileBridge && isAuthError(err)) {
        applyDashboardSnapshot(bootstrapMobileDashboard(periodSelection));
        return;
      }
      setError(apiErrorMessage(err, 'Không tải được tổng quan'));
    } finally {
      setRefreshing(false);
    }
  }, [periodSelection, useMobileBridge, applyDashboardSnapshot, loadDayAnalytics]);

  useEffect(() => {
    if (!useMobileBridge) {
      loadDashboard(true);
      return;
    }

    applyDashboardSnapshot(bootstrapMobileDashboard(periodSelection));

    refreshDashboardInBackground(periodSelection)
      .then((updated) => {
        if (updated) {
          applyDashboardSnapshot(updated, 'server');
          setError('');
        }
      })
      .catch(() => {
        applyDashboardSnapshot(bootstrapMobileDashboard(periodSelection));
      });
  }, []);

  useEffect(() => {
    if (!data) return;
    loadAnalytics(periodSelection);
  }, [periodSelection]);

  useEffect(() => {
    if (!useMobileBridge || !data) return undefined;
    let cancelled = false;
    fetchRepairOpsMarket()
      .then((repair) => {
        if (cancelled || !repair) return;
        setAnalytics((prev) =>
          withCachedMarket(
            prev
              ? { ...prev, market: { ...(prev.market || {}), ...repair } }
              : { period: 'month', chartPeriod: 'month', sales: {}, market: repair }
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [useMobileBridge, data]);

  useEffect(() => {
    if (!data) return;
    loadDayAnalytics();
  }, [data, loadDayAnalytics]);

  useEffect(() => {
    if (!useMobileBridge) return undefined;
    const refreshLocalCharts = () => {
      if (document.visibilityState !== 'visible') return;
      setDayAnalytics(mergeLocalDayAnalytics(getDashboardLocalSnapshot({ id: 'day' })?.analytics));
      setData((prev) => mergeLocalRetailIntoToday(prev));
    };
    document.addEventListener('visibilitychange', refreshLocalCharts);
    window.addEventListener('focus', refreshLocalCharts);
    return () => {
      document.removeEventListener('visibilitychange', refreshLocalCharts);
      window.removeEventListener('focus', refreshLocalCharts);
    };
  }, [useMobileBridge]);

  if (error && !data) {
    return (
      <IosPage>
        <div className={DASHBOARD_PAGE_CLASS}>
          <FeedbackBanner variant="error">{error}</FeedbackBanner>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => loadDashboard(true)} className="apple-btn-primary">
            Thử lại
          </button>
        </div>
        {/* Mobile: không ép nhập URL Mac — local snapshot phải đủ để vào app */}
        {needsServerUrlSetup() && !useMobileBridge && (
          <div className="mt-4">
            <ServerUrlField />
          </div>
        )}
        </div>
      </IosPage>
    );
  }

  if (!data) {
    return (
      <IosPage>
        <div className={`${DASHBOARD_PAGE_CLASS} flex items-center justify-center min-h-[320px]`}>
          <LoadingIndicator label="Đang tải tổng quan..." />
        </div>
      </IosPage>
    );
  }

  const { films, inventory, customers } = data;
  const retail = getRetailSnapshot(data);
  const filmLabActive = hasFilmLabActivity(films);

  return (
    <IosPage>
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="dashboard-page__header flex flex-wrap items-end justify-between gap-3 md:gap-4">
        <h1 className="apple-page-title">Dashboard</h1>
        <RefreshButton onClick={() => loadDashboard(true)} loading={refreshing} />
      </header>

      {error && (
        <div className="mb-4">
          <FeedbackBanner variant="error">{error}</FeedbackBanner>
        </div>
      )}

      <div className="dashboard-page__tabs flex flex-col items-stretch gap-3">
        <div className="dashboard-segment-group dashboard-segment-group--scroll" role="tablist">
          <div className="dashboard-segment-group__track">
            {MOBILE_MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`dashboard-segment-btn ${
                  activeTab === tab.id ? 'dashboard-segment-btn--active' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'store' && (
        <>
          <div className="dashboard-store-desk">
            <StoreOverviewPanel
              retail={retail}
              dayAnalytics={dayAnalytics}
              loading={dayAnalyticsLoading && !dayAnalytics}
              recentSales={retail.recentSales}
              variant="desk"
            />

            <PeriodAnalysisBlock
              title="Phân tích theo kỳ"
              periodSelection={periodSelection}
              onPeriodChange={setPeriodSelection}
              className="dashboard-store-desk__period"
            >
              <SalesRhythmPanel
                analytics={analytics}
                loading={analyticsLoading}
              />
            </PeriodAnalysisBlock>

            <RepairOpsPanel
              analytics={withCachedMarket(analytics)}
              loading={analyticsLoading}
              compact
              className="dashboard-store-desk__repair"
            />
          </div>

          {filmLabActive && (
            <section className="apple-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[17px] font-semibold text-[var(--color-label)]">Lab film</h2>
                  <p className="text-sm text-[var(--color-label-secondary)] mt-1">
                    {films.readyForPickup ?? 0} sẵn trả · {films.processing ?? 0} đang tráng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('lab')}
                  className="apple-btn-secondary text-[13px]"
                >
                  Xem lab →
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'lab' && (
        <>
          <LabFilmCharts films={films} monthly={monthly} />

          <div className="counter-bar--mobile-only mb-4">
            <CounterBar
              items={[
                {
                  id: 'received',
                  label: 'Tiếp nhận',
                  value: films.receivedToday ?? 0,
                  hint: films.deliveredToday > 0 ? `+${films.deliveredToday} trả` : undefined,
                  variant: 'info',
                },
                { id: 'processing', label: 'Đang tráng', value: films.processing ?? 0 },
                { id: 'ready', label: 'Sẵn trả', value: films.readyForPickup ?? 0, variant: 'success' },
                { id: 'waiting', label: 'Khách chờ', value: films.waitingPickup ?? 0, variant: 'warning' },
              ]}
            />
          </div>

          <div className="ios-quick-actions mb-6">
            <Link to="/films" className="ios-quick-action">
              <span className="material-symbols-outlined">movie</span>
              Tiếp nhận film
            </Link>
            <Link to="/inventory" className="ios-quick-action">
              <span className="material-symbols-outlined">science</span>
              Thuốc Tráng
            </Link>
          </div>

          <div className="dashboard-segment-group dashboard-segment-group--row mb-6" role="tablist">
            {[
              { id: 'today', label: 'Việc hôm nay', icon: 'today' },
              { id: 'month', label: 'Tháng & Thuốc Tráng', icon: 'calendar_month' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={opsSubTab === tab.id}
                onClick={() => setOpsSubTab(tab.id)}
                className={`dashboard-segment-btn gap-2 px-4 py-2 text-sm ${
                  opsSubTab === tab.id ? 'dashboard-segment-btn--active' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {opsSubTab === 'today' && (
            <section className="apple-card p-5">
              <h2 className="text-[17px] font-semibold text-[var(--color-label)] mb-4">Việc cần làm</h2>
              <ul className="space-y-3 text-sm">
                {films.readyForPickup > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--color-separator)]">
                    <span className="text-[var(--color-label)]">
                      <strong>{films.readyForPickup}</strong> phiếu sẵn sàng trả khách
                    </span>
                    <Link to="/films" className="apple-btn-ghost text-[13px] !py-1">
                      Xem phiếu film →
                    </Link>
                  </li>
                )}
                {films.waitingPickup > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--color-separator)]">
                    <span className="text-[var(--color-label)]">
                      <strong>{films.waitingPickup}</strong> phiếu chưa trả (đang chờ)
                    </span>
                    <Link to="/films" className="apple-btn-ghost text-[13px] !py-1">
                      Xem phiếu film →
                    </Link>
                  </li>
                )}
                {films.processing > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--color-separator)]">
                    <span className="text-[var(--color-label)]">
                      <strong>{films.processing}</strong> phiếu đang tráng
                    </span>
                    <Link to="/films" className="apple-btn-ghost text-[13px] !py-1">
                      Theo dõi tiến độ →
                    </Link>
                  </li>
                )}
                {films.deliveredToday > 0 && (
                  <li className="flex justify-between py-2 border-b border-[var(--color-separator)]">
                    <span className="text-[var(--color-label-secondary)]">Đã trả khách hôm nay</span>
                    <strong className="text-[var(--color-green)]">{films.deliveredToday}</strong>
                  </li>
                )}
                {films.receivedToday > 0 && (
                  <li className="flex justify-between py-2 border-b border-[var(--color-separator)]">
                    <span className="text-[var(--color-label-secondary)]">Tiếp nhận hôm nay</span>
                    <strong>{films.receivedToday}</strong>
                  </li>
                )}
                {films.readyForPickup === 0 &&
                  films.waitingPickup === 0 &&
                  films.processing === 0 &&
                  films.receivedToday === 0 &&
                  films.deliveredToday === 0 && (
                    <li className="text-[var(--color-label-secondary)] py-2">
                      Chưa có hoạt động film hôm nay —{' '}
                      <Link to="/films" className="text-[var(--color-blue)] font-medium">
                        tiếp nhận phiếu mới
                      </Link>
                    </li>
                  )}
              </ul>
            </section>
          )}

          {opsSubTab === 'month' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="apple-card p-5">
                <h2 className="text-[17px] font-semibold text-[var(--color-label)] mb-1">Thống kê tháng</h2>
                {monthly?.month && (
                  <p className="text-xs text-[var(--color-label-tertiary)] mb-4">{monthly.month}</p>
                )}
                {monthly ? (
                  <>
                    <ul className="space-y-2 text-sm text-[var(--color-label)] mb-6">
                      <li className="flex justify-between">
                        <span className="text-[var(--color-label-secondary)]">Tổng tiếp nhận</span>
                        <strong>{monthly.totalReceived}</strong>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-[var(--color-label-secondary)]">Đã trả khách</span>
                        <strong>{monthly.totalDelivered}</strong>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-[var(--color-label-secondary)]">Khách hàng active</span>
                        <strong>{customers.active}</strong>
                      </li>
                    </ul>
                    <h3 className="text-[13px] font-semibold text-[var(--color-label-secondary)] uppercase tracking-wide mb-3">
                      Tiến độ phiếu trong tháng
                    </h3>
                    <StatusBreakdownChart breakdown={monthly.statusBreakdown} />
                  </>
                ) : (
                  <LoadingIndicator label="Đang tải thống kê..." className="py-4" />
                )}
              </section>

              <section
                className={`apple-card p-5 ${
                  inventory.lowStockCount > 0 ? '!border-[var(--color-red)]/40 !bg-[rgba(255,59,48,0.06)]' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                  <h2 className="text-[17px] font-semibold text-[var(--color-label)]">
                    {inventory.lowStockCount > 0 ? 'Thuốc Tráng sắp hết' : 'Thuốc Tráng'}
                    {inventory.lowStockCount > 0 && (
                      <span className="text-[var(--color-red)] ml-1">({inventory.lowStockCount})</span>
                    )}
                  </h2>
                  <Link to="/inventory" className="apple-btn-ghost text-[13px] !py-1">
                    Xem Thuốc Tráng →
                  </Link>
                </div>
                {inventory.lowStockItems.length === 0 ? (
                  <p className="text-sm text-[var(--color-green)]">Tồn kho ổn định</p>
                ) : (
                  <ul className="space-y-2 mb-4">
                    {inventory.lowStockItems.map((item) => (
                      <li
                        key={item._id}
                        className="flex justify-between gap-2 text-sm border-b border-[var(--color-separator)] pb-2"
                      >
                        <span>{item.itemName}</span>
                        <span className="text-[var(--color-red)] font-medium shrink-0">
                          {item.category === 'chemical'
                            ? `${item.quantityMl || item.quantity} ml`
                            : `${item.quantity} ${item.unit}`}{' '}
                          / min {item.minStock} {item.category === 'chemical' ? 'ml' : item.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {inventory.byCategory.length > 0 && (
                  <div className="pt-3 border-t border-[var(--color-separator)]">
                    <p className="text-xs font-medium text-[var(--color-label-secondary)] mb-2">Tóm tắt danh mục</p>
                    <ul className="space-y-1 text-sm">
                      {inventory.byCategory.map((cat) => (
                        <li key={cat._id} className="flex justify-between text-[var(--color-label-secondary)]">
                          <span>{INVENTORY_CATEGORY_LABELS[cat._id] || cat._id}</span>
                          <span>
                            {cat.totalItems} mặt hàng · SL {cat.totalQuantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {activeTab === 'sales' && (
        <PeriodAnalysisBlock
          title="Hiệu suất kinh doanh"
          subtitle="Phân tích theo kỳ"
          periodSelection={periodSelection}
          onPeriodChange={setPeriodSelection}
        >
          <SalesPerformancePanel analytics={analytics} loading={analyticsLoading} />
        </PeriodAnalysisBlock>
      )}
      {activeTab === 'inventory' && (
        <PeriodAnalysisBlock
          title="Kho & cung ứng"
          subtitle="Phân tích theo kỳ"
          periodSelection={periodSelection}
          onPeriodChange={setPeriodSelection}
        >
          <InventorySupplyPanel analytics={analytics} loading={analyticsLoading} />
        </PeriodAnalysisBlock>
      )}
      {activeTab === 'customers' && (
        <PeriodAnalysisBlock
          title="Khách hàng"
          subtitle="Phân tích theo kỳ"
          periodSelection={periodSelection}
          onPeriodChange={setPeriodSelection}
        >
          <CustomerAnalyticsPanel analytics={analytics} loading={analyticsLoading} />
        </PeriodAnalysisBlock>
      )}
    </div>
    </IosPage>
  );
}

import { Link } from 'react-router-dom';
import LoadingIndicator from '../LoadingIndicator';
import SegmentPieChart from './SegmentPieChart';
import OrdersChart from './OrdersChart';
import DonutChart from './DonutChart';
import GroupedBarChart from './GroupedBarChart';
import { DashboardMetricCard } from './DashboardMetricCard';
import { formatVnd } from '../../utils/formatMoney';
import { CHART, CUSTOMER_SEGMENT_COLORS, formatChartMonth } from '../../utils/chartColors';

function segmentStat(value) {
  return {
    revenue: value?.revenue ?? 0,
    sharePct: value?.sharePct ?? 0,
    orders: value?.orders ?? 0,
  };
}

function normalizeSalesSegments(segments) {
  return {
    body: segmentStat(segments?.body),
    lens: segmentStat(segments?.lens),
    film_supplies: segmentStat(segments?.film_supplies),
  };
}

function normalizeDefectRate(defectRate) {
  return {
    ratePct: defectRate?.ratePct ?? 0,
    defectCount: defectRate?.defectCount ?? 0,
    totalUnits: defectRate?.totalUnits ?? 0,
    samples: Array.isArray(defectRate?.samples) ? defectRate.samples : [],
  };
}

function normalizeCustomerSegments(segments) {
  return {
    labels: {
      newbie: segments?.labels?.newbie ?? 'Người mới',
      pro: segments?.labels?.pro ?? 'Chơi sâu',
    },
    newbie: segmentStat(segments?.newbie),
    pro: segmentStat(segments?.pro),
  };
}

function ShopCameraDefectOpsCard({ defectRate, cameraOps, flat = false }) {
  const defect = normalizeDefectRate(defectRate);
  const counts = cameraOps?.counts || {};
  const waiting = counts.waiting ?? 0;
  const inRepair = counts.inRepair ?? 0;
  const repairSpend = counts.repairSpendMonth ?? 0;
  const repairedSold = counts.repairedSoldCount ?? 0;
  const goodCount = Math.max(0, defect.totalUnits - defect.defectCount);
  const pipelineTotal = waiting + inRepair;

  const slices = [
    { key: 'good', label: 'Máy ổn', value: goodCount, color: CHART.green },
    { key: 'defect', label: 'Có ghi chú lỗi', value: defect.defectCount, color: CHART.red },
    { key: 'waiting', label: 'Chờ sửa', value: waiting, color: CHART.orange },
    { key: 'inRepair', label: 'Đang sửa', value: inRepair, color: CHART.blue },
  ].filter((s) => s.value > 0);

  const chartSlices =
    slices.length > 0
      ? slices
      : defect.totalUnits > 0
        ? [{ key: 'good', label: 'Máy ổn', value: defect.totalUnits, color: CHART.green }]
        : [];

  const hasFooterSamples = defect.samples.length > 0 || cameraOps?.longWaiting?.length > 0;

  return (
    <DashboardMetricCard
      className={`dashboard-metric-card--balanced ${flat ? 'dashboard-flat-widget' : ''}`}
      title="In-house Repair"
      subtitle="Kho tiệm — sửa chữa quản lý"
      chart={
        <DonutChart
          title=""
          slices={chartSlices}
          centerValue={pipelineTotal > 0 ? String(pipelineTotal) : `${defect.ratePct}%`}
          centerFormat="plain"
          centerCaption={pipelineTotal > 0 ? 'đang sửa' : 'tỷ lệ lỗi'}
          emptyText="Chưa có dữ liệu máy"
          className="dashboard-metric-card__donut"
        />
      }
      legend={[
        { key: 'waiting', label: 'Chờ sửa', value: String(waiting), color: CHART.orange },
        { key: 'inRepair', label: 'Đang sửa', value: String(inRepair), color: CHART.blue },
        { key: 'spend', label: 'Tiền sửa tháng', value: formatVnd(repairSpend), color: CHART.indigo },
        { key: 'sold', label: 'Đã bán (có sửa)', value: String(repairedSold), color: CHART.teal },
      ]}
      footer={
        hasFooterSamples ? (
          <ul className="dashboard-metric-card__samples">
            {defect.samples.length > 0 && (
              <li className="dashboard-metric-card__samples-title">Máy có ghi chú lỗi</li>
            )}
            {defect.samples.map((row) => (
              <li key={row.code} className="dashboard-metric-card__sample-row">
                <span className="dashboard-metric-card__sample-name">{row.model}</span>
                <span className="dashboard-metric-card__sample-note">{row.note || '—'}</span>
              </li>
            ))}
            {cameraOps?.longWaiting?.length > 0 && (
              <li className="dashboard-metric-card__samples-title">Tồn sửa lâu (≥7 ngày)</li>
            )}
            {cameraOps?.longWaiting?.map((row) => (
              <li key={row.camera_code} className="dashboard-metric-card__sample-row">
                <span className="dashboard-metric-card__sample-name">{row.model_name}</span>
                <span className="dashboard-metric-card__sample-note">{row.daysWaiting} ngày</span>
              </li>
            ))}
          </ul>
        ) : null
      }
    />
  );
}

function CustomerRepairOpsMetricCard({ customerRepairOps, flat = false }) {
  const counts = customerRepairOps?.counts || {};
  const intake = counts.tiep_nhan ?? 0;
  const awaiting = counts.cho_khach_xac_nhan ?? 0;
  const inRepair = counts.dang_sua ?? 0;
  const ready = counts.cho_tra ?? 0;
  const pipelineTotal = intake + awaiting + inRepair + ready;
  const revenueMonth = counts.revenue_month ?? 0;
  const profitMonth = counts.profit_month ?? 0;

  const pipelineSlices = [
    { key: 'intake', label: 'Tiếp nhận', value: intake, color: CHART.track },
    { key: 'awaiting', label: 'Chờ xác nhận', value: awaiting, color: CHART.orange },
    { key: 'inRepair', label: 'Đang sửa', value: inRepair, color: CHART.blue },
    { key: 'ready', label: 'Chờ trả', value: ready, color: CHART.green },
  ].filter((s) => s.value > 0);

  return (
    <DashboardMetricCard
      className={flat ? 'dashboard-flat-widget' : ''}
      title="Customer Repair"
      subtitle="Dịch vụ sửa chữa (Hỗ trợ - Tính phí)"
      kpis={[
        { key: 'pipeline', label: 'Đang xử lý', value: pipelineTotal, tone: pipelineTotal > 0 ? 'info' : undefined },
        { key: 'awaiting', label: 'Chờ xác nhận', value: awaiting, tone: awaiting > 0 ? 'warn' : undefined },
        { key: 'revenue', label: 'Doanh thu tháng', value: formatVnd(revenueMonth) },
        {
          key: 'profit',
          label: 'Lãi tháng',
          value: formatVnd(profitMonth),
          tone: profitMonth > 0 ? 'ok' : profitMonth < 0 ? 'warn' : undefined,
        },
      ]}
      chart={
        <DonutChart
          title=""
          slices={pipelineSlices}
          centerValue={pipelineTotal}
          centerFormat="plain"
          centerCaption="phiếu mở"
          emptyText="Không có phiếu đang mở"
          className="dashboard-metric-card__donut"
        />
      }
      legend={[
        { key: 'intake', label: 'Tiếp nhận', value: String(intake), color: CHART.track },
        { key: 'awaiting', label: 'Chờ xác nhận', value: String(awaiting), color: CHART.orange },
        { key: 'inRepair', label: 'Đang sửa', value: String(inRepair), color: CHART.blue },
        { key: 'ready', label: 'Chờ trả', value: String(ready), color: CHART.green },
      ]}
    />
  );
}

function MetricRow({ label, value, strong }) {
  return (
    <li className="flex justify-between gap-3 text-sm py-1.5 border-b border-[var(--color-separator)] last:border-0">
      <span className="text-[var(--color-label-secondary)]">{label}</span>
      {strong ? (
        <strong className="text-[var(--color-label)] shrink-0">{value}</strong>
      ) : (
        <span className="text-[var(--color-label)] shrink-0">{value}</span>
      )}
    </li>
  );
}

function ShareBar({ label, pct, color = 'var(--color-blue)' }) {
  return (
    <li>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[var(--color-label-secondary)]">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-fill-secondary)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </li>
  );
}

function SectionCard({ title, subtitle, children, alert }) {
  return (
    <section
      className={`apple-card p-5 ${alert ? '!border-[var(--color-red)]/40 !bg-[rgba(255,59,48,0.05)]' : ''}`}
    >
      <h2 className="text-[17px] font-semibold text-[var(--color-label)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--color-label-tertiary)] mt-1 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

export function SalesPerformancePanel({
  analytics,
  loading,
  embedded = false,
  flat = false,
  skipCharts = false,
}) {
  if (loading && !analytics?.sales) {
    return <LoadingIndicator label="Đang tải hiệu suất kinh doanh..." className="py-8" />;
  }
  if (!analytics?.sales) return null;
  const { sales } = analytics;
  const segments = normalizeSalesSegments(sales.segments);
  const showOrderCharts = !skipCharts && !embedded;
  const chartPeriod = analytics.chartPeriod || analytics.period;

  return (
    <div className={embedded && flat ? 'dashboard-flat-stack' : 'space-y-6'}>
      {showOrderCharts && (
        <>
          <div className="space-y-4">
            <SegmentPieChart
              segments={segments}
              title="Phân rã ngành hàng"
              subtitle="Tỷ lệ doanh thu bán lẻ theo nhóm"
            />
            <OrdersChart series={sales.orderSeries} period={chartPeriod} />
          </div>
        </>
      )}

      {embedded && !skipCharts && chartPeriod !== 'day' && (
        <OrdersChart
          series={sales.orderSeries}
          period={chartPeriod}
          title="Nhịp bán theo kỳ"
          className={flat ? 'dashboard-flat-widget' : ''}
        />
      )}

      {embedded && flat ? (
        <div className="dashboard-flat-widget dashboard-kpi-strip">
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Doanh thu</span>
            <strong className="dashboard-kpi-strip__value">{formatVnd(sales.revenue)}</strong>
          </div>
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Lợi nhuận</span>
            <strong className="dashboard-kpi-strip__value text-[var(--color-green)]">
              {formatVnd(sales.profit)}
            </strong>
          </div>
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Biên LN</span>
            <strong className="dashboard-kpi-strip__value">{sales.grossMarginPct}%</strong>
          </div>
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">AOV</span>
            <strong className="dashboard-kpi-strip__value">{formatVnd(sales.aov)}</strong>
            <span className="dashboard-kpi-strip__meta">{sales.orderCount} đơn</span>
          </div>
        </div>
      ) : (
      <div className={`grid grid-cols-2 ${embedded ? '' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-3`}>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Tổng doanh thu</p>
          <p className="text-xl font-semibold mt-1">{formatVnd(sales.revenue)}</p>
        </div>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Lợi nhuận gộp</p>
          <p className="text-xl font-semibold mt-1 text-[var(--color-green)]">{formatVnd(sales.profit)}</p>
        </div>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Biên lợi nhuận</p>
          <p className="text-xl font-semibold mt-1">{sales.grossMarginPct}%</p>
        </div>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">AOV (giá trị đơn TB)</p>
          <p className="text-xl font-semibold mt-1">{formatVnd(sales.aov)}</p>
          <p className="text-[11px] text-[var(--color-label-tertiary)] mt-1">{sales.orderCount} đơn</p>
        </div>
      </div>
      )}

      <div className={`grid grid-cols-1 ${embedded && flat ? '' : embedded ? '' : 'lg:grid-cols-2'} gap-3`}>
        {!embedded && (
        <SectionCard title="Phân rã ngành hàng" subtitle="Tỷ lệ doanh thu bán lẻ theo nhóm">
          <ul className="space-y-3">
            <ShareBar label="Máy ảnh (Body)" pct={segments.body.sharePct} color={CHART.indigo} />
            <ShareBar label="Ống kính (Lens)" pct={segments.lens.sharePct} color={CHART.blue} />
            <ShareBar
              label="Cuộn film + Pin / vật tư"
              pct={segments.film_supplies.sharePct}
              color={CHART.orange}
            />
          </ul>
          <ul className="mt-4 space-y-1 text-sm">
            <MetricRow label="Body" value={formatVnd(segments.body.revenue)} />
            <MetricRow label="Lens" value={formatVnd(segments.lens.revenue)} />
            <MetricRow label="Film & vật tư" value={formatVnd(segments.film_supplies.revenue)} />
          </ul>
        </SectionCard>
        )}

        {embedded && !flat && (
          <SectionCard title="Phân rã ngành hàng" subtitle="Tỷ lệ doanh thu theo nhóm">
            <ul className="space-y-3">
              <ShareBar label="Máy ảnh" pct={segments.body.sharePct} color={CHART.indigo} />
              <ShareBar label="Ống kính" pct={segments.lens.sharePct} color={CHART.blue} />
              <ShareBar
                label="Film & vật tư"
                pct={segments.film_supplies.sharePct}
                color={CHART.orange}
              />
            </ul>
          </SectionCard>
        )}

        {embedded && flat && (
          <div className="dashboard-flat-widget">
            <p className="dashboard-flat-widget__label">Phân rã ngành hàng</p>
            <ul className="space-y-3">
              <ShareBar label="Máy ảnh" pct={segments.body.sharePct} color={CHART.indigo} />
              <ShareBar label="Ống kính" pct={segments.lens.sharePct} color={CHART.blue} />
              <ShareBar
                label="Film & vật tư"
                pct={segments.film_supplies.sharePct}
                color={CHART.orange}
              />
            </ul>
          </div>
        )}

        {embedded && flat ? (
          <div className="dashboard-flat-widget">
            <p className="dashboard-flat-widget__label">Top sản phẩm</p>
            {sales.topProducts.length === 0 ? (
              <p className="text-sm text-[var(--color-label-secondary)]">Chưa có đơn bán lẻ trong kỳ.</p>
            ) : (
              <ul className="space-y-2">
                {sales.topProducts.map((item, idx) => (
                  <li
                    key={`${item.code}-${idx}`}
                    className="flex justify-between gap-2 text-sm border-b border-[var(--color-separator)] pb-2 last:border-0"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-[var(--color-label-tertiary)] mr-1">#{idx + 1}</span>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-medium text-[12px]">
                      {formatVnd(item.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <SectionCard title="Top sản phẩm bán chạy" subtitle="Theo doanh thu trong kỳ">
          {sales.topProducts.length === 0 ? (
            <p className="text-sm text-[var(--color-label-secondary)]">Chưa có đơn bán lẻ trong kỳ.</p>
          ) : (
            <ul className="space-y-2">
              {sales.topProducts.map((item, idx) => (
                <li
                  key={`${item.code}-${idx}`}
                  className="flex justify-between gap-2 text-sm border-b border-[var(--color-separator)] pb-2"
                >
                  <span className="min-w-0">
                    <span className="text-[var(--color-label-tertiary)] mr-2">#{idx + 1}</span>
                    {item.name}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatVnd(item.revenue)} · {item.quantity} sp
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/retail?tab=sale" className="apple-btn-ghost text-[13px] mt-3 !py-1 inline-flex">
            Mở bán hàng →
          </Link>
        </SectionCard>
        )}
      </div>
    </div>
  );
}

export function InventorySupplyPanel({ analytics, loading }) {
  if (loading) return <LoadingIndicator label="Đang tải kho hàng..." className="py-8" />;
  if (!analytics?.inventory) return null;
  const { inventory } = analytics;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SectionCard
        title="Cảnh báo tồn kho film"
        subtitle="Out of stock & tồn thấp — nguồn cung không ổn định"
        alert={inventory.outOfStock.length > 0}
      >
        {inventory.outOfStock.length === 0 ? (
          <p className="text-sm text-[var(--color-green)] mb-3">Không có SKU film hết hàng.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {inventory.outOfStock.map((row) => (
              <li key={row.sku} className="text-sm text-[var(--color-red)] font-medium">
                {row.name} ({row.sku}) — Hết hàng
              </li>
            ))}
          </ul>
        )}
        {inventory.lowStock.length > 0 && (
          <>
            <p className="text-xs font-medium text-[var(--color-label-secondary)] mb-2">Tồn thấp (≤3 cuộn)</p>
            <ul className="space-y-2">
              {inventory.lowStock.map((row) => (
                <li key={row.sku} className="flex justify-between text-sm">
                  <span>{row.name}</span>
                  <span className="text-[var(--color-orange)] font-medium">{row.quantity} cuộn</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link to="/retail?tab=intake" className="apple-btn-ghost text-[13px] mt-3 !py-1 inline-flex">
          Nhập hàng film →
        </Link>
      </SectionCard>

      <SectionCard
        title="Film Outdate — sắp hết hạn"
        subtitle="Ưu tiên khuyến mãi / xả kho trước 30 ngày"
        alert={inventory.filmOutdatePromo.length > 0}
      >
        {inventory.filmOutdatePromo.length === 0 ? (
          <p className="text-sm text-[var(--color-green)]">Không có lô film cần xả gấp trong 30 ngày.</p>
        ) : (
          <ul className="space-y-2">
            {inventory.filmOutdatePromo.map((row) => (
              <li key={`${row.sku}-${row.expiry_date}`} className="flex justify-between text-sm">
                <span>{row.name}</span>
                <span className="text-[var(--color-red)] font-medium shrink-0">
                  {row.quantity} cuộn · còn {row.daysLeft} ngày
                </span>
              </li>
            ))}
          </ul>
        )}
        {inventory.expiringSoon.length > inventory.filmOutdatePromo.length && (
          <p className="text-xs text-[var(--color-label-tertiary)] mt-3">
            +{inventory.expiringSoon.length - inventory.filmOutdatePromo.length} lô hết hạn trong 90 ngày
          </p>
        )}
      </SectionCard>

      <SectionCard title="Tốc độ quay vòng hàng tồn">
        <ul className="space-y-0">
          <MetricRow
            label="Film — ước tính ngày bán hết tồn"
            value={
              inventory.turnover.filmDaysToSellStock != null
                ? `~${inventory.turnover.filmDaysToSellStock} ngày`
                : 'Chưa đủ dữ liệu'
            }
            strong
          />
          <MetricRow
            label="Đã bán (30 ngày)"
            value={`${inventory.turnover.filmSoldLast30Days} cuộn`}
          />
          <MetricRow label="Tồn hiện tại" value={`${inventory.turnover.currentFilmRolls} cuộn`} />
          <MetricRow
            label="Máy ảnh — TB ngày tồn trước khi bán"
            value={
              inventory.turnover.avgCameraDaysOnHand != null
                ? `${inventory.turnover.avgCameraDaysOnHand} ngày (${inventory.turnover.cameraUnitsSampled} máy)`
                : 'Chưa có máy đã bán'
            }
          />
        </ul>
      </SectionCard>

      <SectionCard
        title="Thuốc Tráng"
        subtitle="Cảnh báo hóa chất lab"
        alert={inventory.chemicalAlerts.length > 0}
      >
        {inventory.chemicalAlerts.length === 0 ? (
          <p className="text-sm text-[var(--color-green)]">Thuốc tráng ổn định.</p>
        ) : (
          <ul className="space-y-2">
            {inventory.chemicalAlerts.map((row) => (
              <li key={row.itemName} className="flex justify-between text-sm">
                <span>{row.itemName}</span>
                <span className="text-[var(--color-red)] font-medium">
                  {row.quantityMl} ml / min {row.minStock} ml
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/inventory" className="apple-btn-ghost text-[13px] mt-3 !py-1 inline-flex">
          Xem Thuốc Tráng →
        </Link>
      </SectionCard>
    </div>
  );
}

export function CustomerAnalyticsPanel({ analytics, loading, flat = false }) {
  if (loading && !analytics?.customers) {
    return <LoadingIndicator label="Đang tải phân tích khách hàng..." className="py-8" />;
  }
  if (!analytics?.customers) return null;
  const { customers } = analytics;
  const segments = normalizeCustomerSegments(customers.segments);
  const labService = customers.labService || {};
  const retention = customers.retention || {};

  const segmentSlices = [
    {
      key: 'newbie',
      label: 'Người mới',
      value: segments.newbie.orders,
      color: CUSTOMER_SEGMENT_COLORS.newbie,
    },
    {
      key: 'pro',
      label: 'Chơi sâu',
      value: segments.pro.orders,
      color: CUSTOMER_SEGMENT_COLORS.pro,
    },
  ].filter((s) => s.value > 0);

  const retentionSlices = [
    {
      key: 'repeat',
      label: 'Quay lại',
      value: retention.labRepeatCustomers ?? 0,
      color: CUSTOMER_SEGMENT_COLORS.repeat,
    },
    {
      key: 'oneTime',
      label: 'Một lần',
      value: retention.labOneTimeCustomers ?? 0,
      color: CUSTOMER_SEGMENT_COLORS.oneTime,
    },
  ].filter((s) => s.value > 0);

  const segmentTotal = segmentSlices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={flat ? 'dashboard-flat-stack' : 'space-y-6'}>
      {flat ? (
        <div className="dashboard-flat-widget dashboard-kpi-strip">
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Doanh thu lab</span>
            <strong className="dashboard-kpi-strip__value">{formatVnd(labService.periodRevenue)}</strong>
          </div>
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Phiếu</span>
            <strong className="dashboard-kpi-strip__value">{labService.periodOrders ?? 0}</strong>
          </div>
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Retention</span>
            <strong className="dashboard-kpi-strip__value text-[var(--color-green)]">
              {retention.labRetentionPct ?? 0}%
            </strong>
          </div>
          <div className="dashboard-kpi-strip__item">
            <span className="dashboard-kpi-strip__label">Active</span>
            <strong className="dashboard-kpi-strip__value">{customers.activeCustomers}</strong>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Doanh thu lab (kỳ)</p>
          <p className="text-xl font-semibold mt-1">{formatVnd(labService.periodRevenue)}</p>
        </div>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Phiếu trong kỳ</p>
          <p className="text-xl font-semibold mt-1">{labService.periodOrders ?? 0}</p>
          <p className="text-[11px] text-[var(--color-label-tertiary)] mt-1">
            {labService.periodRolls ?? 0} cuộn
          </p>
        </div>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Retention lab</p>
          <p className="text-xl font-semibold mt-1 text-[var(--color-green)]">
            {retention.labRetentionPct ?? 0}%
          </p>
        </div>
        <div className="apple-card p-4">
          <p className="text-xs text-[var(--color-label-secondary)]">Khách active</p>
          <p className="text-xl font-semibold mt-1">{customers.activeCustomers}</p>
        </div>
      </div>
      )}

      {flat ? (
        <>
          <DonutChart
            title="Phân khúc khách"
            slices={segmentSlices}
            centerValue={segmentTotal}
            centerFormat="plain"
            centerCaption="phiếu"
            emptyText="Chưa có phiếu trong kỳ"
            className="dashboard-flat-widget store-overview__donut"
            compact
          />
          <DonutChart
            title="Khách quay lại"
            slices={retentionSlices}
            centerValue={`${retention.labRetentionPct ?? 0}%`}
            centerFormat="plain"
            centerCaption="retention"
            emptyText="Chưa đủ dữ liệu"
            className="dashboard-flat-widget store-overview__donut"
            compact
          />
          <div className="dashboard-flat-widget">
            <p className="dashboard-flat-widget__label">Chi tiết phân khúc</p>
            <ul className="space-y-3 mb-3">
              <ShareBar
                label={segments.labels.newbie}
                pct={segments.newbie.sharePct}
                color={CHART.orange}
              />
              <ShareBar
                label={segments.labels.pro}
                pct={segments.pro.sharePct}
                color={CHART.indigo}
              />
            </ul>
            <ul className="space-y-0 text-sm">
              <MetricRow label="Đơn người mới" value={segments.newbie.orders} />
              <MetricRow label="Đơn chơi sâu" value={segments.pro.orders} />
            </ul>
            <Link to="/customers" className="apple-btn-ghost text-[13px] mt-3 !py-1 inline-flex">
              Quản lý khách hàng →
            </Link>
          </div>
        </>
      ) : (
      <>
      <div className="dashboard-panel-charts">
        <DonutChart
          title="Phân khúc khách"
          subtitle="Theo loại film & quy trình"
          slices={segmentSlices}
          centerValue={segmentTotal}
          centerFormat="plain"
          centerCaption="phiếu"
          emptyText="Chưa có phiếu trong kỳ"
          className="dashboard-panel-charts__donut"
          compact
        />
        <DonutChart
          title="Khách quay lại"
          subtitle="Lab — từ lịch sử phiếu tráng"
          slices={retentionSlices}
          centerValue={`${retention.labRetentionPct ?? 0}%`}
          centerFormat="plain"
          centerCaption="retention"
          emptyText="Chưa đủ dữ liệu retention"
          className="dashboard-panel-charts__donut"
          compact
        />
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SectionCard title="Doanh thu dịch vụ Lab" subtitle="Tráng phim & scan — nguồn thu ổn định">
        <ul className="space-y-0">
          <MetricRow label="Doanh thu lab (kỳ)" value={formatVnd(labService.periodRevenue)} strong />
          <MetricRow label="Phiếu trong kỳ" value={labService.periodOrders ?? 0} />
          <MetricRow label="Tổng cuộn" value={labService.periodRolls ?? 0} />
          <MetricRow
            label="Doanh thu lab (lũy kế)"
            value={formatVnd(labService.allTimeRevenue)}
          />
          <MetricRow label="Khách active" value={customers.activeCustomers} />
        </ul>
        <Link to="/films" className="apple-btn-ghost text-[13px] mt-3 !py-1 inline-flex">
          Quản lý phiếu film →
        </Link>
      </SectionCard>

      <SectionCard title="Phân khúc khách hàng" subtitle="Heuristic từ phiếu tráng trong kỳ">
        <ul className="space-y-3 mb-4">
          <ShareBar
            label={segments.labels.newbie}
            pct={segments.newbie.sharePct}
            color={CHART.orange}
          />
          <ShareBar
            label={segments.labels.pro}
            pct={segments.pro.sharePct}
            color={CHART.indigo}
          />
        </ul>
        <ul className="space-y-0">
          <MetricRow label="Đơn người mới" value={segments.newbie.orders} />
          <MetricRow label="Đơn chơi sâu" value={segments.pro.orders} />
          <MetricRow label="Người mua máy (kỳ)" value={retention.cameraBuyersInPeriod ?? 0} />
        </ul>
        <Link to="/customers" className="apple-btn-ghost text-[13px] mt-3 !py-1 inline-flex">
          Quản lý khách hàng →
        </Link>
      </SectionCard>
    </div>
    </>
      )}
    </div>
  );
}

/** Chỉ biểu đồ nhịp bán — dùng trong tab Tổng quan (gọn). */
export function SalesRhythmPanel({ analytics, loading }) {
  if (loading && !analytics?.sales) {
    return <LoadingIndicator label="Đang tải nhịp bán..." className="py-6" />;
  }
  if (!analytics?.sales) return null;
  const chartPeriod = analytics.chartPeriod || analytics.period;
  const series = analytics.sales.orderSeries;
  const points = series?.points || [];
  const hasData = points.some((p) => p.orders > 0);
  const peak = hasData
    ? points.reduce((best, p) => (p.orders > best.orders ? p : best), points[0])
    : null;
  const totalOrders = series?.totalOrders ?? points.reduce((sum, p) => sum + (p.orders || 0), 0);
  const totalRevenue =
    series?.totalRevenue ?? points.reduce((sum, p) => sum + (p.revenue || 0), 0);

  return (
    <div className="dashboard-sales-rhythm dashboard-sales-rhythm--split">
      <div className="dashboard-sales-rhythm__chart-col">
        <OrdersChart
          series={series}
          period={chartPeriod}
          title="Nhịp bán theo kỳ"
          hideHeader
          hideFooter
          className="dashboard-sales-rhythm__chart"
        />
      </div>

      <aside className="dashboard-sales-rhythm__aside" aria-label="Tóm tắt nhịp bán">
        <p className="dashboard-sales-rhythm__aside-label">Tóm tắt</p>
        <dl className="dashboard-sales-rhythm__stats">
          <div className="dashboard-sales-rhythm__stat">
            <dt>Cao nhất</dt>
            <dd>
              {hasData ? (
                <>
                  <strong>{peak?.orders || 0} đơn</strong>
                  <span>{peak?.label || '—'}</span>
                </>
              ) : (
                <strong>—</strong>
              )}
            </dd>
          </div>
          <div className="dashboard-sales-rhythm__stat">
            <dt>Kỳ này</dt>
            <dd>
              <strong>{totalOrders} đơn</strong>
              <span>{formatVnd(totalRevenue)}</span>
            </dd>
          </div>
          {hasData && peak?.revenue != null && (
            <div className="dashboard-sales-rhythm__stat">
              <dt>Đỉnh ngày</dt>
              <dd>
                <strong>{formatVnd(peak.revenue)}</strong>
                <span>doanh thu đỉnh</span>
              </dd>
            </div>
          )}
        </dl>
        {!hasData && (
          <p className="dashboard-sales-rhythm__aside-hint">
            Chưa có đơn trong kỳ — vào Hồ sơ → Nạp dữ liệu test để xem biểu đồ.
          </p>
        )}
      </aside>
    </div>
  );
}

export function RepairOpsPanel({ analytics, loading, flat = false, compact = false, className = '' }) {
  const market = analytics?.market;
  const hasRepair = market?.customerRepairOps || market?.defectRate || market?.cameraOps;

  if (loading && !analytics?.sales && !hasRepair) {
    return <LoadingIndicator label="Đang tải vận hành sửa chữa..." className="py-6" />;
  }
  if (!hasRepair) return null;
  if (!market) return null;
  const defect = normalizeDefectRate(market.defectRate);

  const cards = (
    <div
      className={
        compact
          ? 'dashboard-repair-ops__cards dashboard-repair-ops__cards--compact'
          : flat
            ? 'dashboard-flat-stack'
            : 'space-y-6'
      }
    >
      {market.customerRepairOps && (
        <CustomerRepairOpsMetricCard
          customerRepairOps={market.customerRepairOps}
          flat={flat || compact}
        />
      )}
      {(market.defectRate || market.cameraOps) && (
        <ShopCameraDefectOpsCard
          defectRate={defect}
          cameraOps={market.cameraOps}
          flat={flat || compact}
        />
      )}
    </div>
  );

  if (compact) {
    return (
      <section className={['dashboard-repair-ops', 'dashboard-repair-ops--compact', className].filter(Boolean).join(' ')}>
        {cards}
      </section>
    );
  }

  return (
    <section className={[flat ? 'dashboard-flat-stack' : 'space-y-4', className].filter(Boolean).join(' ')}>
      {!flat && (
        <header>
          <h2 className="text-[17px] font-semibold text-[var(--color-label)]">Vận hành sửa chữa</h2>
          <p className="text-sm text-[var(--color-label-secondary)] mt-1">Tồn hiện tại — không theo kỳ đã chọn</p>
        </header>
      )}
      {cards}
    </section>
  );
}

function formatAnalyticsRangeSubtitle(analytics) {
  const start = analytics?.range?.start;
  const end = analytics?.range?.end;
  if (!start || !end) return 'Giá bán TB vs giá vốn TB theo kỳ đã chọn';
  const fmt = (iso) =>
    new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)} · giá bán TB vs vốn TB`;
}

export function MarketTrendsPanel({ analytics, loading, flat = false }) {
  if (loading && !analytics?.market) {
    return <LoadingIndicator label="Đang tải xu hướng thị trường..." className="py-8" />;
  }
  if (!analytics?.market) return null;
  const { market } = analytics;
  const filmPriceTrend = Array.isArray(market.filmPriceTrend) ? market.filmPriceTrend : [];
  const importCostTrend = Array.isArray(market.importCostTrend) ? market.importCostTrend : [];

  const pricePoints = filmPriceTrend.map((row) => ({
    key: row.month,
    label: row.label || formatChartMonth(row.month),
    values: {
      sell: row.avgSellPrice,
      cost: row.avgImportCost,
    },
  }));

  const widgetClass = flat ? 'dashboard-flat-widget' : 'apple-card dashboard-grouped-bar--card';
  const chartPeriod = analytics.chartPeriod || analytics.period;
  const filmChartTitle =
    chartPeriod === 'month' || chartPeriod === 'year' ? 'Giá film theo tháng' : 'Giá film theo kỳ';

  return (
    <div className={flat ? 'dashboard-flat-stack' : 'space-y-6'}>
      <GroupedBarChart
        title={filmChartTitle}
        subtitle={flat ? 'Bán vs vốn' : formatAnalyticsRangeSubtitle(analytics)}
        points={pricePoints}
        series={[
          { key: 'sell', label: 'Giá bán TB', color: CHART.blue },
          { key: 'cost', label: 'Giá vốn TB', color: CHART.orange },
        ]}
        formatValue={formatVnd}
        emptyText="Chưa có bán film trong kỳ này"
        className={widgetClass}
      />

      {importCostTrend.length > 0 && (
        <p className="text-xs text-[var(--color-label-tertiary)] px-1">
          Nhập kho trong kỳ:{' '}
          {importCostTrend.map((r) => `${r.label || formatChartMonth(r.month)} ${formatVnd(r.avgImportCost)}`).join(' · ')}
        </p>
      )}

      {!flat && analytics.dataNotes?.length > 0 && (
        <section className="apple-card p-4 lg:col-span-2 bg-[var(--color-bg-secondary)]">
          <p className="text-xs font-medium text-[var(--color-label-secondary)] mb-2">Ghi chú dữ liệu</p>
          <ul className="text-xs text-[var(--color-label-tertiary)] space-y-1 list-disc pl-4">
            {analytics.dataNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

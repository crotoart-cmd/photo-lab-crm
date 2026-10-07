import { Link } from 'react-router-dom';
import DonutChart from './DonutChart';
import OrdersChart from './OrdersChart';
import LoadingIndicator from '../LoadingIndicator';
import { formatVnd } from '../../utils/formatMoney';
import {
  REVENUE_SEGMENT_COLORS,
  REVENUE_SEGMENT_LABELS,
  STOCK_SEGMENT_COLORS,
} from '../../utils/chartColors';

function compactDaySeries(series) {
  if (!series?.points?.length) return series;
  const active = series.points.filter((p) => p.orders > 0);
  if (active.length >= 3) {
    return { ...series, points: active };
  }
  return {
    ...series,
    points: series.points.filter((p) => {
      const hour = Number.parseInt(p.key.replace('h', ''), 10);
      return hour >= 8 && hour <= 21;
    }),
  };
}

function revenueSlices(segments, revenueTotal = 0) {
  const slices = ['body', 'lens', 'film_supplies']
    .map((key) => ({
      key,
      label: REVENUE_SEGMENT_LABELS[key],
      value: segments?.[key]?.revenue || 0,
      color: REVENUE_SEGMENT_COLORS[key],
      meta: segments?.[key]?.revenue ? formatVnd(segments[key].revenue) : undefined,
    }))
    .filter((s) => s.value > 0);
  if (slices.length === 0 && revenueTotal > 0) {
    return [
      {
        key: 'total',
        label: 'Doanh thu',
        value: revenueTotal,
        color: REVENUE_SEGMENT_COLORS.body,
        meta: formatVnd(revenueTotal),
      },
    ];
  }
  return slices;
}

export default function StoreOverviewPanel({
  retail,
  dayAnalytics,
  loading = false,
  recentSales = [],
  variant = 'default',
}) {
  if (loading && !dayAnalytics && !retail.salesToday && !retail.revenueToday) {
    return <LoadingIndicator label="Đang tải biểu đồ..." className="py-6" />;
  }

  const sales = dayAnalytics?.sales;
  const revenueToday = sales?.revenue ?? retail.revenueToday ?? 0;
  const revenueSlicesData = revenueSlices(sales?.segments, revenueToday);
  const stockTotal =
    (retail.cameraReady || 0) + (retail.filmBatches || 0) + (retail.batterySkus || 0);

  const stockSlices = [
    {
      key: 'camera',
      label: 'Máy sẵn bán',
      value: retail.cameraReady || 0,
      color: STOCK_SEGMENT_COLORS.camera,
    },
    {
      key: 'film',
      label: 'Lô film',
      value: retail.filmBatches || 0,
      color: STOCK_SEGMENT_COLORS.film,
    },
    {
      key: 'battery',
      label: 'SKU pin',
      value: retail.batterySkus || 0,
      color: STOCK_SEGMENT_COLORS.battery,
    },
  ].filter((s) => s.value > 0);

  const stockSlicesDisplay =
    stockSlices.length > 0
      ? stockSlices
      : stockTotal > 0
        ? [{ key: 'total', label: 'Tồn kho', value: stockTotal, color: STOCK_SEGMENT_COLORS.camera }]
        : [];

  const orderSeries = compactDaySeries(sales?.orderSeries);

  const charts = (
    <div className="store-overview__charts dashboard-store-desk__charts">
      <DonutChart
        title="Doanh thu hôm nay"
        subtitle="Phân bổ theo ngành hàng"
        slices={revenueSlicesData}
        centerValue={revenueToday}
        centerCaption={`${sales?.orderCount ?? retail.salesToday} đơn`}
        emptyText="Chưa có đơn bán hôm nay"
        className="store-overview__donut"
        compact
      />

      <DonutChart
        title="Tồn kho bán lẻ"
        subtitle="Máy · film · pin"
        slices={stockSlicesDisplay}
        centerValue={stockTotal}
        centerFormat="plain"
        centerCaption="đơn vị"
        emptyText="Chưa có hàng trong kho"
        className="store-overview__donut"
        compact
      />
    </div>
  );

  const recent =
    recentSales.length > 0 ? (
      <section className="apple-card p-4 store-overview__recent dashboard-store-desk__recent">
        <div className="flex items-center justify-between gap-2 mb-2 store-overview__recent-head">
          <h2 className="text-[15px] font-semibold text-[var(--color-label)]">Giao dịch gần nhất</h2>
          <Link to="/retail?tab=sale" className="apple-btn-ghost text-[12px] !py-1">
            Quét bán →
          </Link>
        </div>
        <ul className="store-overview__recent-bars" role="list">
          {recentSales.map((sale, idx) => {
            const maxAmount = Math.max(...recentSales.map((s) => s.amount || 0), 1);
            const widthPct = Math.round(((sale.amount || 0) / maxAmount) * 100);
            return (
              <li key={`${sale.code}-${idx}`} className="store-overview__recent-row">
                <div className="store-overview__recent-meta">
                  <span className="store-overview__recent-name">{sale.name || sale.code}</span>
                  <span className="store-overview__recent-amount">{formatVnd(sale.amount)}</span>
                </div>
                <div className="store-overview__recent-track" aria-hidden>
                  <div
                    className="store-overview__recent-fill"
                    style={{ width: `${Math.max(widthPct, 6)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null;

  const dayRhythm = (
    <OrdersChart
      series={orderSeries}
      period="day"
      title="Nhịp bán trong ngày"
      subtitle="Số đơn theo khung giờ"
      className="store-overview__day-rhythm"
    />
  );

  if (variant === 'desk') {
    return (
      <>
        {charts}
        {recent}
      </>
    );
  }

  return (
    <div className="store-overview">
      <div className="store-overview__top">
        {charts}
        {recent}
      </div>
      {dayRhythm}
    </div>
  );
}

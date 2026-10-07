import { useId } from 'react';

import { formatVnd } from '../../utils/formatMoney';
import { CHART } from '../../utils/chartColors';

const PERIOD_LABELS = {
  day: 'Hôm nay theo giờ',
  week: '7 ngày qua',
  month: 'Theo ngày trong tháng',
  quarter: 'Theo tuần trong quý',
  year: 'Theo tháng trong năm',
};

function buildAreaGeometry(points, width, height) {
  const pad = { top: 28, right: 18, bottom: 22, left: 6 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxOrders = Math.max(1, ...points.map((p) => p.orders));
  const step = points.length > 1 ? chartW / (points.length - 1) : 0;

  const nodes = points.map((point, i) => ({
    ...point,
    x: pad.left + i * step,
    y: pad.top + chartH - (point.orders / maxOrders) * chartH,
  }));

  const baseline = pad.top + chartH;
  let line = `M ${nodes[0].x} ${baseline}`;
  nodes.forEach((n) => {
    line += ` L ${n.x} ${n.y}`;
  });
  const area = `${line} L ${nodes[nodes.length - 1].x} ${baseline} Z`;

  const peak = nodes.reduce(
    (best, n) => (n.orders > best.orders ? n : best),
    nodes[0] || { orders: 0 }
  );

  return { nodes, area, peak, pad, chartH, baseline, maxOrders };
}

function AreaChart({ points }) {
  const gradientId = useId();
  const width = 400;
  const height = 180;
  const { nodes, area, peak, pad, baseline } = buildAreaGeometry(points, width, height);
  const peakIndex = nodes.findIndex((n) => n.key === peak.key);
  const showTooltip = peak.orders > 0;
  const labelY = height - 5;

  return (
    <div className="dashboard-orders__area">
      <svg
        className="dashboard-orders__area-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Biểu đồ nhịp bán theo giờ"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.blue} stopOpacity="0.28" />
            <stop offset="100%" stopColor={CHART.blue} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {nodes.map((node) => (
          <line
            key={`grid-${node.key}`}
            x1={node.x}
            y1={pad.top}
            x2={node.x}
            y2={baseline}
            className="dashboard-orders__grid-line"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <polyline
          points={nodes.map((n) => `${n.x},${n.y}`).join(' ')}
          fill="none"
          stroke={CHART.blue}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showTooltip && (
          <>
            <line
              x1={peak.x}
              y1={pad.top}
              x2={peak.x}
              y2={baseline}
              className="dashboard-orders__peak-line"
            />
            <circle cx={peak.x} cy={peak.y} r="4" fill={CHART.blue} />
          </>
        )}

        {nodes.map((node) => (
          <text
            key={`label-${node.key}`}
            x={node.x}
            y={labelY}
            textAnchor="middle"
            className="dashboard-orders__axis-label"
          >
            {node.label}
          </text>
        ))}
      </svg>

      {showTooltip && (
        <div
          className="dashboard-orders__tooltip"
          style={{
            left: `${(peakIndex / Math.max(nodes.length - 1, 1)) * 100}%`,
          }}
        >
          <strong>{peak.orders} đơn</strong>
          <span>{formatVnd(peak.revenue)}</span>
        </div>
      )}
    </div>
  );
}

export default function OrdersChart({
  series,
  period = 'month',
  title = 'Đơn bán lẻ',
  subtitle,
  className = '',
  hideHeader = false,
  hideFooter = false,
}) {
  const points = series?.points || [];
  const maxOrders = Math.max(1, ...points.map((p) => p.orders));

  const periodSubtitle = subtitle || PERIOD_LABELS[period] || '';
  const hasData = points.some((p) => p.orders > 0);
  const useArea = points.length <= 16;
  const peak = hasData
    ? points.reduce((best, p) => (p.orders > best.orders ? p : best), points[0])
    : null;

  return (
    <section
      className={[
        'dashboard-orders',
        !hasData ? 'dashboard-orders--empty' : '',
        hideHeader ? 'dashboard-orders--no-header' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={title || 'Biểu đồ đơn bán'}
    >
      {!hideHeader && (
        <header className="dashboard-orders__header">
          <h3 className="dashboard-orders__title">{title}</h3>
          {periodSubtitle ? <p className="dashboard-orders__subtitle">{periodSubtitle}</p> : null}
        </header>
      )}

      {!hasData ? (
        <p className="dashboard-orders__empty">Chưa có đơn bán lẻ trong kỳ.</p>
      ) : useArea ? (
        <AreaChart points={points} />
      ) : (
        <div className="dashboard-orders__chart-wrap">
          <div className="dashboard-orders__chart" role="img" aria-label="Biểu đồ số đơn theo thời gian">
            {points.map((point) => {
              const heightPct = Math.round((point.orders / maxOrders) * 100);
              return (
                <div key={point.key} className="dashboard-orders__col">
                  <span className="dashboard-orders__axis-top">{point.label}</span>
                  <span className="dashboard-orders__value">{point.orders > 0 ? point.orders : ''}</span>
                  <div
                    className="dashboard-orders__bar"
                    style={{ height: `${Math.max(point.orders > 0 ? 8 : 0, heightPct)}%` }}
                    title={`${point.label}: ${point.orders} đơn · ${formatVnd(point.revenue)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hideFooter && hasData && series?.totalOrders != null && (
        <footer className="dashboard-orders__footer">
          <div className="dashboard-orders__stat">
            <span className="dashboard-orders__stat-label">Cao nhất</span>
            <span className="dashboard-orders__stat-value">
              {peak?.label || '—'} · {peak?.orders || 0} đơn
            </span>
          </div>
          <div className="dashboard-orders__stat">
            <span className="dashboard-orders__stat-label">Hôm nay</span>
            <span className="dashboard-orders__stat-value">
              {series.totalOrders} đơn · {formatVnd(series.totalRevenue)}
            </span>
          </div>
        </footer>
      )}
    </section>
  );
}

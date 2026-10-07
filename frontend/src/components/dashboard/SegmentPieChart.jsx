import { formatVnd } from '../../utils/formatMoney';
import { CHART, REVENUE_SLICE_META } from '../../utils/chartColors';

const SLICE_META = REVENUE_SLICE_META;

function buildConicGradient(segments) {
  let cursor = 0;
  const parts = [];
  for (const meta of SLICE_META) {
    const pct = segments?.[meta.key]?.sharePct || 0;
    if (pct <= 0) continue;
    const end = cursor + pct;
    parts.push(`${meta.color} ${cursor}% ${end}%`);
    cursor = end;
  }
  if (parts.length === 0) return `conic-gradient(${CHART.track} 0% 100%)`;
  if (cursor < 100) parts.push(`${CHART.track} ${cursor}% 100%`);
  return `conic-gradient(${parts.join(', ')})`;
}

export default function SegmentPieChart({ segments, title = 'Phân rã ngành hàng', subtitle }) {
  const slices = SLICE_META.map((meta) => ({
    ...meta,
    revenue: segments?.[meta.key]?.revenue || 0,
    sharePct: segments?.[meta.key]?.sharePct || 0,
  })).filter((s) => s.sharePct > 0);

  const total = slices.reduce((sum, s) => sum + s.sharePct, 0);

  if (total === 0) {
    return (
      <section className="dashboard-pie">
        <header className="dashboard-pie__header">
          <h3 className="dashboard-pie__title">{title}</h3>
          {subtitle ? <p className="dashboard-pie__subtitle">{subtitle}</p> : null}
        </header>
        <p className="dashboard-pie__empty">Chưa có doanh thu bán lẻ trong kỳ.</p>
      </section>
    );
  }

  return (
    <section className="dashboard-pie" aria-label={title}>
      <header className="dashboard-pie__header">
        <h3 className="dashboard-pie__title">{title}</h3>
        {subtitle ? <p className="dashboard-pie__subtitle">{subtitle}</p> : null}
      </header>

      <div className="dashboard-pie__body">
        <div
          className="dashboard-pie__ring"
          style={{ background: buildConicGradient(segments) }}
          role="img"
          aria-label={slices.map((s) => `${s.label} ${s.sharePct}%`).join(', ')}
        >
          <div className="dashboard-pie__ring-hole">
            <span className="dashboard-pie__ring-total">{total}%</span>
            <span className="dashboard-pie__ring-caption">doanh thu</span>
          </div>
        </div>

        <ul className="dashboard-pie__legend">
          {slices.map((slice) => (
            <li key={slice.key} className="dashboard-pie__legend-item">
              <span className="dashboard-pie__dot" style={{ background: slice.color }} aria-hidden />
              <span className="dashboard-pie__legend-text">
                <span className="dashboard-pie__legend-label">{slice.label}</span>
                <span className="dashboard-pie__legend-meta">
                  {slice.sharePct}% · {formatVnd(slice.revenue)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

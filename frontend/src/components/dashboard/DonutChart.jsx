import { formatVnd, formatVndFromValue, formatVndFull } from '../../utils/formatMoney';
import { CHART } from '../../utils/chartColors';

function withSharePct(slices) {
  const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) {
    return slices.map((s) => ({ ...s, sharePct: 0 }));
  }
  return slices.map((s) => ({
    ...s,
    sharePct: Math.round(((Number(s.value) || 0) / total) * 1000) / 10,
  }));
}

function DonutSvg({ slices, size = 120, stroke = 11, gap = 3 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;

  return (
    <svg
      className="dashboard-donut__svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={CHART.track}
        strokeWidth={stroke}
        strokeLinecap="round"
        opacity="0.55"
      />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {slices.map((slice) => {
          const pct = slice.sharePct / 100;
          const length = Math.max(0, pct * circumference - gap);
          const dashoffset = -cursor * circumference - gap / 2;
          cursor += pct;
          return (
            <circle
              key={slice.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Biểu đồ tròn (donut) — SVG stroke, chữ giữa không bị che
 */
export default function DonutChart({
  title,
  subtitle,
  slices = [],
  centerValue,
  centerCaption,
  centerFormat = 'currency',
  emptyText = 'Chưa có dữ liệu',
  formatValue,
  className = '',
  compact = false,
}) {
  const normalized = withSharePct(slices).filter((s) => s.sharePct > 0);
  const hasData = normalized.length > 0;
  const ringSize = compact ? 136 : 148;
  const stroke = compact ? 15 : 12;
  const displayCenter =
    centerFormat === 'plain'
      ? String(centerValue ?? '')
      : formatVndFromValue(centerValue);
  const fullCenter =
    centerFormat === 'plain'
      ? String(centerValue ?? '')
      : typeof centerValue === 'number'
        ? formatVndFull(centerValue)
        : String(centerValue ?? '');

  return (
    <section
      className={`dashboard-pie dashboard-donut${compact ? ' dashboard-donut--compact' : ''} ${className}`.trim()}
      aria-label={title}
    >
      <header className="dashboard-pie__header">
        <h3 className="dashboard-pie__title">{title}</h3>
        {subtitle && !compact ? <p className="dashboard-pie__subtitle">{subtitle}</p> : null}
      </header>

      {!hasData ? (
        <div className="dashboard-donut__empty-state">
          <div className="dashboard-donut__ring-wrap">
            <DonutSvg slices={[]} size={ringSize} stroke={stroke} />
            <div className="dashboard-donut__center">
              <span className="dashboard-donut__center-value">{displayCenter}</span>
              {centerCaption ? (
                <span className="dashboard-donut__center-caption">{centerCaption}</span>
              ) : null}
            </div>
          </div>
          <p className="dashboard-pie__empty">{emptyText}</p>
        </div>
      ) : (
        <div className="dashboard-pie__body dashboard-donut__body">
          <div className="dashboard-donut__ring-wrap">
            <DonutSvg slices={normalized} size={ringSize} stroke={stroke} />
            <div className="dashboard-donut__center">
              <span
                className="dashboard-donut__center-value"
                title={displayCenter !== fullCenter ? fullCenter : undefined}
              >
                {displayCenter}
              </span>
              {centerCaption ? (
                <span className="dashboard-donut__center-caption">{centerCaption}</span>
              ) : null}
            </div>
          </div>

          <ul
            className={`dashboard-pie__legend${
              compact ? ' dashboard-pie__legend--grid' : ''
            }`}
          >
            {normalized.map((slice) => (
              <li key={slice.key} className="dashboard-pie__legend-item">
                <span className="dashboard-pie__dot" style={{ background: slice.color }} aria-hidden />
                {compact ? (
                  <>
                    <span className="dashboard-pie__legend-label">{slice.label}</span>
                    <span className="dashboard-pie__legend-meta">{slice.sharePct}%</span>
                  </>
                ) : (
                  <span className="dashboard-pie__legend-text">
                    <span className="dashboard-pie__legend-label">{slice.label}</span>
                    <span className="dashboard-pie__legend-meta">
                      {slice.sharePct}%
                      {slice.meta != null ? ` · ${slice.meta}` : ''}
                      {formatValue && slice.value != null ? ` · ${formatValue(slice.value)}` : ''}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export { formatVnd as donutFormatVnd } from '../../utils/formatMoney';

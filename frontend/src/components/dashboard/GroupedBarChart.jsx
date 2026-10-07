/**
 * Cột kép / nhóm — so sánh 2+ chuỗi theo từng mốc (vd. giá bán vs giá vốn theo tháng).
 */
export default function GroupedBarChart({
  title,
  subtitle,
  points = [],
  series = [],
  formatValue = (v) => String(v),
  emptyText = 'Chưa có dữ liệu',
  className = '',
}) {
  const hasData = points.some((p) =>
    series.some((s) => Number(p.values?.[s.key] ?? p[s.key] ?? 0) > 0)
  );

  const maxVal = Math.max(
    1,
    ...points.flatMap((p) =>
      series.map((s) => Number(p.values?.[s.key] ?? p[s.key] ?? 0))
    )
  );

  const getValue = (point, key) => Number(point.values?.[key] ?? point[key] ?? 0);

  return (
    <section className={`dashboard-grouped-bar ${className}`.trim()} aria-label={title}>
      <header className="dashboard-grouped-bar__header">
        <h3 className="dashboard-grouped-bar__title">{title}</h3>
        {subtitle ? <p className="dashboard-grouped-bar__subtitle">{subtitle}</p> : null}
      </header>

      {!hasData ? (
        <p className="dashboard-grouped-bar__empty">{emptyText}</p>
      ) : (
        <>
          <div className="dashboard-grouped-bar__chart-wrap">
            <div
              className="dashboard-grouped-bar__chart"
              role="img"
              aria-label={points
                .map((p) =>
                  `${p.label}: ${series.map((s) => `${s.label} ${formatValue(getValue(p, s.key))}`).join(', ')}`
                )
                .join('; ')}
            >
              {points.map((point) => (
                <div key={point.key || point.label} className="dashboard-grouped-bar__col">
                  <div className="dashboard-grouped-bar__pair">
                    {series.map((s) => {
                      const val = getValue(point, s.key);
                      const heightPct = Math.round((val / maxVal) * 100);
                      return (
                        <div
                          key={s.key}
                          className="dashboard-grouped-bar__bar"
                          style={{
                            height: `${Math.max(val > 0 ? 10 : 0, heightPct)}%`,
                            background: `linear-gradient(180deg, ${s.color} 0%, ${s.color}88 100%)`,
                          }}
                          title={`${point.label} · ${s.label}: ${formatValue(val)}`}
                        />
                      );
                    })}
                  </div>
                  <span className="dashboard-grouped-bar__label">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          <ul className="dashboard-grouped-bar__legend">
            {series.map((s) => (
              <li key={s.key} className="dashboard-grouped-bar__legend-item">
                <span className="dashboard-pie__dot" style={{ background: s.color }} aria-hidden />
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

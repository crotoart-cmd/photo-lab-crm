/**
 * Card phân tích — header + KPI strip + chart trái / legend phải (tham khảo dashboard finance).
 */
export function DashboardMetricCard({ title, subtitle, kpis = [], chart, legend = [], footer, className = '' }) {
  const stripOnly = !chart && legend.length === 0;
  return (
    <section
      className={`dashboard-metric-card${stripOnly ? ' dashboard-metric-card--strip-only' : ''} ${className}`.trim()}
      aria-label={title}
    >
      <header className="dashboard-metric-card__head">
        <div className="dashboard-metric-card__intro">
          <h3 className="dashboard-metric-card__title">{title}</h3>
          {subtitle ? <p className="dashboard-metric-card__subtitle">{subtitle}</p> : null}
        </div>
      </header>

      {kpis.length > 0 && (
        <div
          className={`dashboard-metric-card__kpis dashboard-metric-card__kpis--${Math.min(kpis.length, 4)}`.trim()}
        >
          {kpis.map((kpi) => (
            <div key={kpi.key} className="dashboard-metric-card__kpi">
              <span className="dashboard-metric-card__kpi-label">{kpi.label}</span>
              <strong
                className={`dashboard-metric-card__kpi-value${kpi.tone ? ` dashboard-metric-card__kpi-value--${kpi.tone}` : ''}`}
              >
                {kpi.value}
              </strong>
              {kpi.hint ? <span className="dashboard-metric-card__kpi-hint">{kpi.hint}</span> : null}
            </div>
          ))}
        </div>
      )}

      {(chart || legend.length > 0) && (
        <div className="dashboard-metric-card__body">
          {chart ? <div className="dashboard-metric-card__chart">{chart}</div> : null}
          {legend.length > 0 ? (
            <div className="dashboard-metric-card__legend-wrap">
              <p className="dashboard-metric-card__legend-title">Chi tiết</p>
              <ul
                className="dashboard-metric-card__legend"
                role="list"
                style={{ '--legend-rows': Math.ceil(legend.length / 2) }}
              >
                {legend.map((item) => (
                  <li key={item.key} className="dashboard-metric-card__legend-item">
                    <span
                      className="dashboard-metric-card__legend-bar"
                      style={{ background: item.color }}
                      aria-hidden
                    />
                    <span className="dashboard-metric-card__legend-label">{item.label}</span>
                    <span className="dashboard-metric-card__legend-value">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {footer ? <div className="dashboard-metric-card__footer">{footer}</div> : null}
    </section>
  );
}

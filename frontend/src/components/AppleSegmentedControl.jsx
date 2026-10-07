/**
 * iOS-style segmented control — một hàng, cuộn ngang khi nhiều mục, chữ không wrap.
 */
export default function AppleSegmentedControl({ items, value, onChange, className = '' }) {
  return (
    <div
      className={`dashboard-segment-group dashboard-segment-group--scroll apple-segmented-control ${className}`.trim()}
      role="tablist"
    >
      <div className="dashboard-segment-group__track apple-segmented-control__track">
        {items.map((item) => {
          const id = item.id ?? '';
          const active = value === id;
          return (
            <button
              key={String(id) || '__all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={`dashboard-segment-btn ${active ? 'dashboard-segment-btn--active' : ''}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LabStatusRail({ items, value, onChange, label = 'Lọc trạng thái' }) {
  return (
    <div className="lab-filter-tabs" role="tablist" aria-label={label}>
      {items.map((item) => {
        const id = item.id ?? '';
        const on = value === id;
        return (
          <button
            key={String(id) || '__all'}
            type="button"
            role="tab"
            aria-selected={on}
            className={on ? 'is-on' : ''}
            onClick={() => onChange(id)}
          >
            <span>{item.label}</span>
            {item.count != null ? <span className="lab-filter-count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function LabPager({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  const marks = [];
  for (let i = 1; i <= pageCount; i += 1) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) marks.push(i);
    else if (marks[marks.length - 1] !== 'gap') marks.push('gap');
  }
  return (
    <nav className="lab-pager" aria-label="Phân trang">
      <button type="button" disabled={page <= 1} aria-label="Trang trước" onClick={() => onChange(page - 1)}>
        ‹
      </button>
      {marks.map((mark, index) =>
        mark === 'gap' ? (
          <span key={`gap-${index}`} className="lab-pager__gap">
            …
          </span>
        ) : (
          <button
            key={mark}
            type="button"
            className={mark === page ? 'is-on' : ''}
            aria-current={mark === page ? 'page' : undefined}
            onClick={() => onChange(mark)}
          >
            {mark}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= pageCount}
        aria-label="Trang sau"
        onClick={() => onChange(page + 1)}
      >
        ›
      </button>
    </nav>
  );
}

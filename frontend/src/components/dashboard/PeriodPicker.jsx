const PERIOD_OPTIONS = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'quarter', label: 'Quý' },
  { id: 'year', label: 'Năm' },
];

export const DASHBOARD_PERIODS = PERIOD_OPTIONS.map((o) => o.id);

/**
 * Bộ lọc kỳ — nhỏ, nhúng trong section (không trùng style tab điều hướng).
 */
export default function PeriodPicker({ value, onChange, className = '', 'aria-label': ariaLabel = 'Khoảng thời gian' }) {
  return (
    <div
      className={`dashboard-period-picker ${className}`.trim()}
      role="group"
      aria-label={ariaLabel}
    >
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`dashboard-period-picker__btn ${
            value === opt.id ? 'dashboard-period-picker__btn--active' : ''
          }`}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { PERIOD_OPTIONS };

const VARIANT_STYLES = {
  default: {
    card: 'border-[var(--color-separator)] bg-gradient-to-br from-[#f8f9fb] to-white',
    value: 'text-[var(--color-label)]',
    icon: 'text-[var(--color-label-tertiary)]',
  },
  warning: {
    card: 'border-[#ffb74d]/50 bg-gradient-to-br from-[#fff8e1] to-[#fff3e0]',
    value: 'text-[#e65100]',
    icon: 'text-[#ffb74d]',
  },
  success: {
    card: 'border-[var(--color-green)]/30 bg-gradient-to-br from-[rgba(52,199,89,0.1)] to-white',
    value: 'text-[var(--color-green)]',
    icon: 'text-[var(--color-green)]/40',
  },
  info: {
    card: 'border-[var(--color-blue)]/25 bg-gradient-to-br from-[rgba(0,122,255,0.08)] to-white',
    value: 'text-[var(--color-blue)]',
    icon: 'text-[var(--color-blue)]/35',
  },
};

export default function StatCard({ label, value, hint, variant = 'default', icon }) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${styles.card}`}>
      {icon && (
        <span
          className={`material-symbols-outlined absolute top-4 right-4 text-[32px] select-none ${styles.icon}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <p className="text-[12px] font-medium text-[var(--color-label-secondary)] pr-10">{label}</p>
      <p className={`text-[32px] font-semibold tracking-tight mt-1 ${styles.value}`}>{value}</p>
      {hint && <p className="text-[12px] text-[var(--color-label-secondary)] mt-2">{hint}</p>}
    </div>
  );
}

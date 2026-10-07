/** Indeterminate progress — Apple HIG “Loading” pattern */
export default function LoadingIndicator({ label = 'Đang tải...', className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="apple-spinner"
        aria-hidden="true"
      />
      {label ? (
        <p className="text-[15px] text-[var(--color-label-secondary)]">{label}</p>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SPIN_MS = 520;

/** Nút làm mới — pill secondary, icon xoay khi bấm (đồng bộ toàn app) */
export default function RefreshButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Làm mới',
  loadingLabel = 'Đang tải...',
  className = '',
}) {
  const [localSpin, setLocalSpin] = useState(false);
  const clickedAt = useRef(0);
  const clearTimer = useRef(null);

  const spinning = loading || localSpin;
  const busy = disabled || spinning;

  const scheduleSpinEnd = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    const elapsed = Date.now() - clickedAt.current;
    const remain = Math.max(0, MIN_SPIN_MS - elapsed);
    clearTimer.current = setTimeout(() => {
      setLocalSpin(false);
      clearTimer.current = null;
    }, remain);
  }, []);

  useEffect(() => {
    if (!loading && localSpin) {
      scheduleSpinEnd();
    }
  }, [loading, localSpin, scheduleSpinEnd]);

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  const handleClick = (e) => {
    if (busy) return;
    clickedAt.current = Date.now();
    setLocalSpin(true);
    onClick?.(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`refresh-btn apple-btn-secondary gap-2 shrink-0 ${className}`.trim()}
      aria-busy={spinning}
    >
      <span
        className={`refresh-btn__icon material-symbols-outlined text-[20px] ${
          spinning ? 'refresh-btn__icon--spin' : ''
        }`}
        aria-hidden
      >
        refresh
      </span>
      {spinning ? loadingLabel : label}
    </button>
  );
}

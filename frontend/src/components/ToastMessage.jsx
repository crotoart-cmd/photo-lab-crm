import { useCallback, useEffect, useRef, useState } from 'react';
import StatusPill, { resolveStatusPillVariant } from './StatusPill';

const TOAST_PILL_VARIANT = {
  success: 'success',
  error: 'failed',
  failed: 'failed',
  info: 'active',
  processing: 'processing',
};

const TOAST_PILL_ICON = {
  success: 'check',
  failed: 'close',
  error: 'close',
  info: 'info',
  processing: 'progress_activity',
};

/**
 * Toast floating dưới status bar — tự đóng 3s, vuốt lên để đóng.
 */
export default function ToastMessage({
  open,
  variant = 'success',
  title,
  message,
  durationMs = 3000,
  onClose,
}) {
  const [dragY, setDragY] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const touchStartY = useRef(null);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      onClose?.();
      setLeaving(false);
      setDragY(0);
    }, 180);
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    setDragY(0);
    setLeaving(false);
    timerRef.current = window.setTimeout(dismiss, durationMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [open, durationMs, dismiss, title, message, variant]);

  const onTouchStart = (e) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (touchStartY.current == null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy < 0) setDragY(dy);
  };

  const onTouchEnd = () => {
    if (dragY < -48) {
      dismiss();
    } else {
      setDragY(0);
      if (open) timerRef.current = window.setTimeout(dismiss, 1200);
    }
    touchStartY.current = null;
  };

  if (!open) return null;

  const pillVariant = TOAST_PILL_VARIANT[variant] || resolveStatusPillVariant(variant);
  const pillIcon = TOAST_PILL_ICON[variant] || 'info';
  const hasTitle = Boolean(title?.trim());

  return (
    <div
      className={`toast-message toast-message--${variant}${leaving ? ' toast-message-leaving' : ''}`}
      role="status"
      aria-live="polite"
      style={{ transform: `translateY(${Math.min(0, dragY)}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <StatusPill variant={pillVariant} icon={pillIcon} iconOnly />
      <div className="toast-message-text">
        {hasTitle && <p className="toast-message-title">{title}</p>}
        {message && (
          <p className={`toast-message-body${hasTitle ? '' : ' toast-message-body-only'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

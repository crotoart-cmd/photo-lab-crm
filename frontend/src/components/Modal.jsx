import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, children, onClose, wide = false, footer = null, compact = false }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = prevTouch;
    };
  }, []);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const sheet = (
    <div
      className="ios-modal-backdrop fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.32)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdrop}
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
    >
      <div
        className={`apple-card ios-modal-sheet flex w-full flex-col overflow-hidden sm:max-w-lg ${
          wide ? 'sm:max-w-3xl' : ''
        } ${compact ? 'ios-modal-sheet--compact' : ''}`}
        style={{ boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ios-modal-header flex shrink-0 items-center justify-between border-b border-[var(--color-separator)] px-4 py-2.5 sm:px-6 sm:py-3">
          <h2
            id="modal-title"
            className="text-[16px] font-semibold tracking-tight text-[var(--color-label)] sm:text-[18px]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[var(--color-fill-secondary)]"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--color-label-secondary)]">
              close
            </span>
          </button>
        </div>
        <div className="ios-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
          {children}
        </div>
        {footer ? <div className="ios-modal-footer shrink-0">{footer}</div> : null}
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

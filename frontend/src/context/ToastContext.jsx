import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ToastMessage from '../components/ToastMessage';

const ToastContext = createContext(null);

/** Tách "Tiêu đề — nội dung" nếu chuỗi có dấu em dash rõ ràng. */
export function parseToastText(text) {
  const raw = String(text || '').trim();
  if (!raw) return { message: '' };

  const dashIdx = raw.indexOf(' — ');
  if (dashIdx > 0 && dashIdx < 48) {
    return {
      title: raw.slice(0, dashIdx).trim(),
      message: raw.slice(dashIdx + 3).trim(),
    };
  }
  return { message: raw };
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const hideToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((input) => {
    const payload = typeof input === 'string' ? parseToastText(input) : input;
    const title = payload?.title?.trim() || undefined;
    const message = payload?.message?.trim() || undefined;
    if (!title && !message) return;

    setToast({
      variant: payload.variant || 'success',
      title,
      message,
      durationMs: payload.durationMs ?? 3000,
    });
  }, []);

  const showError = useCallback((input) => {
    const payload = typeof input === 'string' ? parseToastText(input) : { ...input };
    let title = payload?.title?.trim() || undefined;
    const message = payload?.message?.trim() || undefined;
    if (!title && !message) return;
    if (!title) title = 'Thất bại';

    setToast({
      variant: 'failed',
      title,
      message,
      durationMs: payload.durationMs ?? 3000,
    });
  }, []);

  const value = useMemo(() => ({ showToast, showError, hideToast }), [showToast, showError, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-message-host" aria-hidden={!toast}>
        <ToastMessage
          open={Boolean(toast)}
          variant={toast?.variant}
          title={toast?.title}
          message={toast?.message}
          durationMs={toast?.durationMs}
          onClose={hideToast}
        />
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

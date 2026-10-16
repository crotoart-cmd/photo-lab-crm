import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePublicLocale } from './PublicLocale';
import PublicMobileIcon from './PublicMobileIcon';

export default function PublicMobileDialog({ open, onClose, title, children }) {
  const { t } = usePublicLocale();
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const wasInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    panel.current?.querySelector('input, button, a[href]')?.focus({ preventScroll: true });
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(max-width: 767px)');
    const onResize = () => { if (!media.matches) close.current(); };
    const onKey = (event) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onResize);
    return () => {
      if (root) root.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onResize);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="pm-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="pm-dialog" ref={panel} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" className="pm-icon-button" title={t('mpage.close')} aria-label={t('mpage.close')} onClick={onClose}><PublicMobileIcon name="close" /></button></header>
        {children}
      </section>
    </div>, document.body,
  );
}

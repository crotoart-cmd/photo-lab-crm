import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MOBILE_MORE, MOBILE_TABS, mobileTabForPath } from '../../config/publicMobileNavigation';
import PublicMobileIcon from './PublicMobileIcon';
import { usePublicLocale } from './PublicLocale';

export default function PublicMobileTabs() {
  const { t } = usePublicLocale();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const dialog = useRef(null);
  const currentTab = mobileTabForPath(pathname);
  const moreActive = currentTab === 'more';

  useEffect(() => {
    setOpen(false);
    if (window.matchMedia('(max-width: 767px)').matches) window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const onResize = () => { if (!media.matches) setOpen(false); };
    const overflow = document.body.style.overflow;
    const background = [...document.querySelectorAll('.public-site > .ps-main, .public-site > .ps-header-bar, .public-site > .ps-footer, .ps-mtabs')];
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button, a[href]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onResize);
    return () => {
      background.forEach((element, i) => { element.inert = previousInert[i]; });
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onResize);
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <nav className="ps-mtabs" aria-label={t('mpage.navigation')}>
        {MOBILE_TABS.map((tab) => {
          const current = currentTab === tab.id;
          const active = current && !open;
          return (
            <Link key={tab.id} to={tab.to} className={active ? 'is-on' : ''} aria-current={current ? (pathname === tab.to ? 'page' : 'location') : undefined} aria-label={t(tab.key)} title={t(tab.key)}>
              <span className="ps-mtab-symbol" aria-hidden><PublicMobileIcon name={tab.icon} /></span>
              <span className="ps-mtab-label" aria-hidden="true">{t(tab.labelKey || tab.key)}</span>
            </Link>
          );
        })}
        <button
          ref={trigger}
          type="button"
          className={moreActive || open ? 'is-on' : undefined}
          aria-label={t('mpage.more')}
          title={t('mpage.more')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? 'ps-mobile-more' : undefined}
          onClick={() => setOpen(true)}
        >
          <span className="ps-mtab-symbol" aria-hidden><PublicMobileIcon name="more_horiz" /></span>
          <span className="ps-mtab-label" aria-hidden="true">{t('mpage.more')}</span>
        </button>
      </nav>
      {open ? (
        <div className="ps-mmore-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={dialog} id="ps-mobile-more" className="ps-mmore" role="dialog" aria-modal="true" aria-labelledby="ps-mobile-more-title">
            <header>
              <h2 id="ps-mobile-more-title">{t('mpage.more')}</h2>
              <button type="button" className="ps-micon-button" aria-label={t('mpage.close')} title={t('mpage.close')} onClick={() => setOpen(false)}><PublicMobileIcon name="close" /></button>
            </header>
            <nav aria-label={t('mpage.more')}>
              {MOBILE_MORE.map((item) => (
                <Link key={item.to} to={item.to} className="ps-mpro-row" aria-current={pathname === item.to ? 'page' : undefined} onClick={() => setOpen(false)}>
                  <span><b>{t(item.key)}</b>{item.hint ? <i>{t(item.hint)}</i> : null}</span>
                  <PublicMobileIcon name="chevron_right" />
                </Link>
              ))}
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}

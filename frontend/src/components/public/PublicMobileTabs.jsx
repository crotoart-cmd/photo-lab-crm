import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PATH } from '../../config/publicPaths';
import PublicMobileIcon from './PublicMobileIcon';
import { usePublicLocale } from './PublicLocale';

const TABS = [
  { to: '/', key: 'mpage.home', id: 'today', icon: 'home' },
  { to: PATH.film, key: 'nav.film', id: 'film', icon: 'movie' },
  { to: PATH.repair, key: 'nav.repair', id: 'repair', icon: 'build' },
  { to: PATH.shop, key: 'mtab.shop', id: 'shop', icon: 'storefront' },
];
const MORE = [
  { to: PATH.scan, key: 'nav.scan', hint: 'mhome.card.scanSub' },
  { to: PATH.print, key: 'nav.print', hint: 'svc.in-analog.caption' },
  { to: PATH.speed, key: 'nav.speed', hint: 'mhome.quietSpec' },
  { to: PATH.blog, key: 'nav.blog', hint: 'mhome.notes' },
  { to: PATH.contact, key: 'nav.contact', hint: 'mhome.map' },
  { to: PATH.faq, key: 'nav.faq' },
];

export default function PublicMobileTabs() {
  const { t } = usePublicLocale();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const dialog = useRef(null);
  const moreActive = !TABS.some((tab) => tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to));

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
        {TABS.map((tab) => {
          const current = tab.to === '/' ? pathname === '/' : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          const active = current && !open;
          return (
            <Link key={tab.id} to={tab.to} className={active ? 'is-on' : ''} aria-current={current ? 'page' : undefined} aria-label={t(tab.key)} title={t(tab.key)}>
              <span className="ps-mtab-symbol" aria-hidden><PublicMobileIcon name={tab.icon} /></span>
              <span className="ps-mtab-label" aria-hidden="true">{t(tab.key)}</span>
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
              {MORE.map((item) => (
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

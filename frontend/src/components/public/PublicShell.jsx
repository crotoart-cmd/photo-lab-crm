import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BRAND_NAME } from '../../config/brand';
import PsGridFrame from './PsGridFrame';
import { PsLangSwitch, PublicLocaleProvider, usePublicLocale } from './PublicLocale';

const NAV = [
  { to: '/film', key: 'nav.film' },
  { to: '/toc-do', key: 'nav.speed' },
  { to: '/in-analog', key: 'nav.print' },
  { to: '/scan', key: 'nav.scan' },
  { to: '/sua-may', key: 'nav.repair' },
  { to: '/lien-he', key: 'nav.contact', extra: true },
];

function NavItems({ onPick, className }) {
  const { t } = usePublicLocale();
  return (
    <nav className={className} aria-label="Menu">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => [isActive ? 'is-active' : '', item.extra ? 'ps-nav-extra' : ''].filter(Boolean).join(' ')}
          onClick={onPick}
        >
          {t(item.key)}
        </NavLink>
      ))}
    </nav>
  );
}

function PublicShellInner() {
  const { t } = usePublicLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerOn, setHeaderOn] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('public-web');
    document.body.classList.add('public-web');
    return () => {
      document.documentElement.classList.remove('public-web');
      document.body.classList.remove('public-web');
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setHeaderOn(true);
      return undefined;
    }
    const id = window.setTimeout(() => setHeaderOn(true), 50);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <div className="public-site">
      <header className={`ps-header-bar${headerOn ? ' is-on' : ''}`}>
        <div className="ps-header ps-grid">
          <Link to="/" className="ps-brand" onClick={close}>
            {BRAND_NAME}
          </Link>
          <NavItems className="ps-nav" />
          <PsLangSwitch />
          <button type="button" className="ps-burger" aria-label={t('menu.open')} onClick={() => setMenuOpen(true)}>
            <span />
            <span />
            <span />
          </button>
        </div>
        <span className="ps-header-line" aria-hidden="true" />
      </header>

      {menuOpen ? (
        <div className="ps-drawer" role="dialog" aria-label="Menu">
          <div className="ps-drawer-top">
            <Link to="/" className="ps-brand" onClick={close}>
              {BRAND_NAME}
            </Link>
            <button type="button" className="ps-drawer-close" onClick={close}>
              {t('menu.close')}
            </button>
          </div>
          <NavItems className="" onPick={close} />
          <PsLangSwitch />
        </div>
      ) : null}

      <div className="ps-main">
        <Outlet />
      </div>
      <footer className="ps-footer ps-grid">
        <PsGridFrame tone="footer" />
        <div className="ps-foot-col ps-foot-brand">
          <Link to="/" className="ps-brand" onClick={close}>
            {BRAND_NAME}
          </Link>
          <p className="ps-foot-label">{t('foot.news')}</p>
          <form
            className="ps-foot-news"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <label>
              <span className="ps-hp">{t('foot.last')}</span>
              <input type="text" name="lastName" placeholder={t('foot.last')} autoComplete="family-name" />
            </label>
            <label>
              <span className="ps-hp">{t('foot.first')}</span>
              <input type="text" name="firstName" placeholder={t('foot.first')} autoComplete="given-name" />
            </label>
            <label className="ps-foot-news-mail">
              <span className="ps-hp">{t('foot.email')}</span>
              <input type="email" name="email" placeholder={t('foot.email')} autoComplete="email" required />
              <button type="submit" aria-label={t('foot.submit')}>
                →
              </button>
            </label>
          </form>
          <p className="ps-foot-note">{t('foot.note')}</p>
        </div>

        <div className="ps-foot-col ps-foot-nav">
          <p className="ps-foot-label">{t('foot.links')}</p>
          <ul>
            <li>
              <Link to="/">{t('foot.home')}</Link>
            </li>
            <li>
              <Link to="/film">{t('foot.sendRoll')}</Link>
            </li>
            <li>
              <Link to="/in-analog">{t('nav.print')}</Link>
            </li>
            <li>
              <Link to="/scan">{t('nav.scan')}</Link>
            </li>
            <li>
              <Link to="/lien-he">{t('nav.contact')}</Link>
            </li>
          </ul>
          <p className="ps-foot-copy">© {BRAND_NAME} 2026</p>
        </div>

        <div className="ps-foot-col ps-foot-services">
          <p className="ps-foot-label">{t('foot.services')}</p>
          <ul>
            <li>
              <Link to="/film">{t('nav.film')}</Link>
            </li>
            <li>
              <Link to="/toc-do">{t('nav.speed')}</Link>
            </li>
            <li>
              <Link to="/in-analog">{t('nav.print')}</Link>
            </li>
            <li>
              <Link to="/scan">{t('nav.scan')}</Link>
            </li>
            <li>
              <Link to="/sua-may">{t('nav.repair')}</Link>
            </li>
            <li>
              <span>{t('foot.shopSoon')}</span>
            </li>
          </ul>
          <div className="ps-foot-push">
            <p className="ps-foot-label">{t('foot.contact')}</p>
            <ul>
              <li>
                <Link to="/lien-he">{t('foot.meet')}</Link>
              </li>
              <li>
                <span>{t('foot.quoteMail')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="ps-foot-col ps-foot-more">
          <p className="ps-foot-label">{t('foot.help')}</p>
          <ul>
            <li>
              <Link to="/toc-do">{t('foot.turnaround')}</Link>
            </li>
            <li>
              <Link to="/sua-may">{t('foot.sendCam')}</Link>
            </li>
            <li>
              <Link to="/film">{t('foot.pickup')}</Link>
            </li>
            <li>
              <span>{t('foot.eduSoon')}</span>
            </li>
          </ul>
          <div className="ps-foot-push">
            <p className="ps-foot-label">{t('foot.lab')}</p>
            <ul>
              <li>
                <span>{t('foot.chem')}</span>
              </li>
              <li>
                <span>{t('foot.proc')}</span>
              </li>
              <li>
                <span>{t('foot.cams')}</span>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PublicShell() {
  return (
    <PublicLocaleProvider>
      <PublicShellInner />
    </PublicLocaleProvider>
  );
}

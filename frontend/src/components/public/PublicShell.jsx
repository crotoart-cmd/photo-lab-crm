import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BRAND_NAME, LOGO_SRC } from '../../config/brand';
import PsGridFrame from './PsGridFrame';
import { PsLangSwitch, PublicLocaleProvider, usePublicLocale } from './PublicLocale';

const DEV_SCAN_NAV = [
  { to: '/film', key: 'nav.film' },
  { to: '/toc-do', key: 'nav.speed' },
  { to: '/scan', key: 'nav.scan' },
  { to: '/in-analog', key: 'nav.print' },
];

const NAV = [
  { type: 'group', key: 'nav.devScan', children: DEV_SCAN_NAV },
  { to: '/sua-may', key: 'nav.repair' },
  { to: '/phu-kien', key: 'nav.acc' },
  { to: '/blog', key: 'nav.blog' },
  { to: '/lien-he', key: 'nav.contact' },
  { to: '/faq', key: 'nav.faq' },
];

function PsBrand({ onClick }) {
  return (
    <Link to="/" className="ps-brand" onClick={onClick} aria-label={BRAND_NAME}>
      <img src={LOGO_SRC} alt={BRAND_NAME} width={300} height={50} />
    </Link>
  );
}

function NavGroup({ item, onPick, drawer }) {
  const { t } = usePublicLocale();
  const { pathname } = useLocation();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const childOn = item.children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));

  useEffect(() => {
    if (drawer || !open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [drawer, open]);

  const links = item.children.map((child) => (
    <NavLink
      key={child.to}
      to={child.to}
      className={({ isActive }) => (isActive ? 'is-active' : '')}
      onClick={() => {
        setOpen(false);
        onPick?.();
      }}
    >
      {t(child.key)}
    </NavLink>
  ));

  if (drawer) {
    return (
      <div className="ps-nav-cluster">
        <p className="ps-label">{t(item.key)}</p>
        {links}
      </div>
    );
  }

  return (
    <div className={`ps-nav-group${childOn ? ' is-on' : ''}${open ? ' is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="ps-nav-group-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t(item.key)}
      </button>
      {open ? (
        <div className="ps-nav-drop" role="menu">
          {links}
        </div>
      ) : null}
    </div>
  );
}

function NavItems({ onPick, className, drawer }) {
  const { t } = usePublicLocale();
  return (
    <nav className={className} aria-label="Menu">
      {NAV.map((item) =>
        item.type === 'group' ? (
          <NavGroup key={item.key} item={item} onPick={onPick} drawer={drawer} />
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => [isActive ? 'is-active' : '', item.extra ? 'ps-nav-extra' : ''].filter(Boolean).join(' ')}
            onClick={onPick}
          >
            {t(item.key)}
          </NavLink>
        ),
      )}
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
          <PsBrand onClick={close} />
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
            <PsBrand onClick={close} />
            <button type="button" className="ps-drawer-close" onClick={close}>
              {t('menu.close')}
            </button>
          </div>
          <NavItems className="" onPick={close} drawer />
          <PsLangSwitch />
        </div>
      ) : null}

      <div className="ps-main">
        <Outlet />
      </div>
      <footer className="ps-footer ps-grid">
        <PsGridFrame tone="footer" />
        <div className="ps-foot-col ps-foot-brand">
          <PsBrand onClick={close} />
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
              <Link to="/phu-kien">{t('nav.acc')}</Link>
            </li>
            <li>
              <Link to="/blog">{t('nav.blog')}</Link>
            </li>
            <li>
              <Link to="/lien-he">{t('nav.contact')}</Link>
            </li>
            <li>
              <Link to="/faq">{t('nav.faq')}</Link>
            </li>
          </ul>
          <p className="ps-foot-copy">© {BRAND_NAME} 2026</p>
        </div>

        <div className="ps-foot-col ps-foot-services">
          <p className="ps-foot-label">{t('foot.services')}</p>
          <p className="ps-foot-label ps-foot-sub">{t('nav.devScan')}</p>
          <ul>
            <li>
              <Link to="/film">{t('nav.film')}</Link>
            </li>
            <li>
              <Link to="/toc-do">{t('nav.speed')}</Link>
            </li>
            <li>
              <Link to="/scan">{t('nav.scan')}</Link>
            </li>
            <li>
              <Link to="/in-analog">{t('nav.print')}</Link>
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
              <Link to="/faq">{t('nav.faq')}</Link>
            </li>
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

import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BRAND_NAME } from '../../config/brand';

const NAV = [
  { to: '/film', label: 'Tráng film' },
  { to: '/sua-may', label: 'Sửa máy' },
  { to: '/lien-he', label: 'Liên hệ' },
];

function NavItems({ onPick, className }) {
  return (
    <nav className={className} aria-label="Menu">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (isActive ? 'is-active' : '')}
          onClick={onPick}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function PublicShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('public-web');
    document.body.classList.add('public-web');
    return () => {
      document.documentElement.classList.remove('public-web');
      document.body.classList.remove('public-web');
    };
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
      <header className="ps-header">
        <Link to="/" className="ps-brand" onClick={close}>
          {BRAND_NAME}
        </Link>
        <NavItems className="ps-nav" />
        <Link to="/film" className="ps-cta">
          Gửi cuộn
        </Link>
        <button type="button" className="ps-burger" aria-label="Mở menu" onClick={() => setMenuOpen(true)}>
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen ? (
        <div className="ps-drawer" role="dialog" aria-label="Menu">
          <div className="ps-drawer-top">
            <Link to="/" className="ps-brand" onClick={close}>
              {BRAND_NAME}
            </Link>
            <button type="button" className="ps-drawer-close" onClick={close}>
              Đóng
            </button>
          </div>
          <NavItems className="" onPick={close} />
          <Link to="/film" className="ps-cta ps-cta--on-dark" onClick={close}>
            Gửi cuộn
          </Link>
        </div>
      ) : null}

      <div className="ps-main">
        <Outlet />
      </div>
      <footer className="ps-footer">
        <strong>{BRAND_NAME}</strong>
        <span>Lab film · sửa máy analog</span>
        <Link to="/lien-he">Liên hệ</Link>
      </footer>
    </div>
  );
}

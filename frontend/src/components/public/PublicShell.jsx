import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import { BRAND_NAME } from '../../config/brand';

export default function PublicShell() {
  useEffect(() => {
    document.documentElement.classList.add('public-web');
    return () => document.documentElement.classList.remove('public-web');
  }, []);

  return (
    <div className="public-site">
      <header className="ps-header">
        <Link to="/" className="ps-brand" aria-label={BRAND_NAME}>
          <BrandLogo size="sm" />
        </Link>
        <nav className="ps-nav" aria-label="Dịch vụ">
          <NavLink to="/film" className={({ isActive }) => (isActive ? 'is-active' : '')}>
            Tráng film
          </NavLink>
          <NavLink to="/sua-may" className={({ isActive }) => (isActive ? 'is-active' : '')}>
            Sửa máy
          </NavLink>
        </nav>
      </header>
      <main className="ps-main">
        <Outlet />
      </main>
      <footer className="ps-footer">
        <p>
          <strong>{BRAND_NAME}</strong>
          {' · '}
          Lab film và sửa máy analog. Ảnh scan và báo giá gửi qua email trên phiếu.
        </p>
      </footer>
    </div>
  );
}

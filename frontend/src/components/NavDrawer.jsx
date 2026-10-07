import { NavLink, useLocation } from 'react-router-dom';
import { NAV_GROUPS, isNavItemActive } from '../config/navigation';
import BrandLogo from './BrandLogo';
import NavItemIcon from './icons/NavItemIcon';

function NavItem({ item, location }) {
  const active = isNavItemActive(item, location);
  const className = [
    'apple-nav-item',
    active ? 'apple-nav-item-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={className}
      title={item.label}
      aria-label={item.label}
    >
      <NavItemIcon item={item} />
      <span className="apple-nav-item__label">{item.label}</span>
    </NavLink>
  );
}

/** Sidebar desktop — rail icon, hover bung nhãn */
export default function NavDrawer({ user, isOwner, onLogout }) {
  const location = useLocation();

  return (
    <div className="apple-nav-rail-slot shrink-0 desktop-shell-only">
      <aside className="apple-nav-drawer">
        <div className="apple-nav-drawer-header">
          <BrandLogo size="sm" className="apple-nav-brand" />
        </div>

        <nav className="apple-nav-scroll" aria-label="Menu chính">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="apple-nav-section">
              <p className="apple-nav-section-label">{group.label}</p>
              {group.items.map((item) => (
                <NavItem key={`${group.id}-${item.label}`} item={item} location={location} />
              ))}
            </div>
          ))}
        </nav>

        <div className="apple-nav-footer">
          <div className="apple-nav-footer-meta">
            <p className="text-sm font-medium truncate text-[var(--color-label)]">{user?.name}</p>
            <p className="text-xs mt-0.5 text-[var(--color-label-secondary)]">
              {isOwner ? 'Chủ hệ thống' : 'Nhân viên'}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="apple-btn-destructive apple-nav-logout w-full mt-3 justify-start"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              logout
            </span>
            <span className="apple-nav-logout-label">Đăng xuất</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

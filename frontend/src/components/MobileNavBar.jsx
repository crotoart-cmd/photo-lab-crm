import { NavLink, useLocation } from 'react-router-dom';
import { NAV_GROUPS, isNavItemActive } from '../config/navigation';
import BrandLogo from './BrandLogo';
import NavItemIcon from './icons/NavItemIcon';
import SubNavBar from './SubNavBar';
import MobileSyncMenuPanel from './MobileSyncMenuPanel';
import { IconPersonAdd } from './icons/tabBarIcons';
import { useMobileSyncStatus } from '../hooks/useMobileSyncStatus';

export default function MobileNavBar({ user, isOwner, onLogout, open, onOpenChange }) {
  const location = useLocation();
  const setOpen = (value) => onOpenChange?.(value);
  const customersActive = location.pathname.startsWith('/customers');
  const { hasAttention } = useMobileSyncStatus();

  return (
    <>
      <SubNavBar
        className="mobile-shell-only"
        leading={(
          <div className="relative shrink-0">
            <BrandLogo size="sm" onClick={() => setOpen(true)} />
            {hasAttention && (
              <span
                className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--color-orange)] ring-2 ring-white"
                aria-hidden
              />
            )}
          </div>
        )}
        rightAction="icon"
        rightIconComponent={IconPersonAdd}
        rightLabel="Khách hàng"
        rightHref="/customers"
        rightActive={customersActive}
      />

      {open && (
        <div className="ios-drawer-backdrop mobile-shell-only">
          <aside className="ios-drawer-panel">
            <div className="ios-drawer-header">
              <span className="font-semibold text-[var(--color-label)]">Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="apple-btn-ghost !p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="mb-4">
                  <p className="apple-nav-section-label">{group.label}</p>
                  {group.items.map((item) => {
                    const active = isNavItemActive(item, location);
                    const cls = [
                      'apple-nav-item',
                      active ? 'apple-nav-item-active' : '',
                      item.accent && active ? 'apple-nav-item-accent' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <NavLink
                        key={item.label}
                        to={item.to}
                        end={item.end}
                        className={cls}
                        onClick={() => setOpen(false)}
                      >
                        <NavItemIcon item={item} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </nav>
            <MobileSyncMenuPanel />
            <div className="p-4 border-t border-[var(--color-separator)]">
              <button
                type="button"
                className="apple-btn-destructive w-full justify-start"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                <span className="material-symbols-outlined">logout</span>
                Đăng xuất
              </button>
            </div>
          </aside>
          <button
            type="button"
            className="ios-drawer-scrim"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}

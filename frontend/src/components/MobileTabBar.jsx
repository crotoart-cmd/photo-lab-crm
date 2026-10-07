import { forwardRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MOBILE_TAB_ITEMS, isNavItemActive } from '../config/navigation';
import { TAB_BAR_CUSTOM_ICONS } from './icons/tabBarIcons';
import { ICON_SIZE } from './icons/iconSizes';

const MobileTabBar = forwardRef(function MobileTabBar(_props, ref) {
  const location = useLocation();

  return (
    <nav ref={ref} className="tab-bar tab-bar--fixed mobile-shell-only" aria-label="Điều hướng chính">
      <div className="tab-bar-inner">
        {MOBILE_TAB_ITEMS.map((item) => {
          const active = isNavItemActive(item, location);
          const CustomIcon = item.tabIcon ? TAB_BAR_CUSTOM_ICONS[item.tabIcon] : null;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              className={`tab-bar-item${active ? ' tab-bar-item--active' : ''}`}
            >
              {CustomIcon ? (
                <CustomIcon className="tab-bar-item__svg" size={ICON_SIZE.tab} />
              ) : (
                <span className="material-symbols-outlined" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="tab-bar-item-label">{item.shortLabel || item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
});

export default MobileTabBar;

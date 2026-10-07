import { NAV_CUSTOM_ICONS } from './tabBarIcons';
import { ICON_SIZE } from './iconSizes';

/** Menu drawer / sidebar — Figma nav icon hoặc fallback Material */
export default function NavItemIcon({ item, size = ICON_SIZE.nav, className = '' }) {
  const Custom = item.navIcon ? NAV_CUSTOM_ICONS[item.navIcon] : null;

  if (Custom) {
    return (
      <span
        className={['apple-nav-item__svg', className].filter(Boolean).join(' ')}
        aria-hidden
      >
        <Custom size={size} framed={false} />
      </span>
    );
  }

  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {item.icon}
    </span>
  );
}

import { NavLink } from 'react-router-dom';
import IconFilter from './icons/IconFilter';
import { ICON_SIZE } from './icons/iconSizes';

/**
 * SubNavBar — Figma lv.02
 * Variants: no action · text action · filter + icon action · filter button · filtered state
 */
export default function SubNavBar({
  title,
  subtitle,
  leading = null,
  onBack,
  backLabel = 'Quay lại',
  filter = false,
  filterVariant = 'icon',
  filterActive = false,
  filterLabel = 'Lọc',
  onFilterClick,
  rightAction = null,
  rightLabel,
  rightIcon = 'more_horiz',
  rightIconComponent: RightIcon = null,
  onRightClick,
  rightHref,
  rightActive = false,
  rightMuted = false,
  centered = null,
  className = '',
  sticky = false,
  mobileOnly = false,
  children,
}) {
  const hasFilter = Boolean(filter);
  const hasRight = rightAction != null;
  const useCentered = centered ?? (hasFilter && hasRight && rightAction === 'icon');

  const rootClass = [
    'sub-nav-bar',
    useCentered && 'sub-nav-bar--centered',
    rightAction === 'text' && 'sub-nav-bar--text-action',
    sticky && 'sub-nav-bar--sticky',
    mobileOnly && 'sub-nav-bar--mobile-only',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const renderFilter = () => {
    if (!hasFilter) return null;

    if (filterVariant === 'button') {
      return (
        <button
          type="button"
          className={`sub-nav-bar-filter-btn${filterActive ? ' is-active' : ''}`}
          onClick={onFilterClick}
          aria-label={filterLabel}
          aria-pressed={filterActive}
        >
          <IconFilter />
          {filterLabel}
        </button>
      );
    }

    return (
      <button
        type="button"
        className={`sub-nav-bar-filter${filterActive ? ' is-active' : ''}`}
        onClick={onFilterClick}
        aria-label={filterLabel}
        aria-pressed={filterActive}
      >
        <IconFilter />
      </button>
    );
  };

  const renderRight = () => {
    if (!hasRight) return null;

    if (rightAction === 'text') {
      const textClass = [
        'sub-nav-bar-text',
        rightMuted && 'sub-nav-bar-text--muted',
        rightActive && 'is-active',
      ]
        .filter(Boolean)
        .join(' ');

      if (rightHref) {
        return (
          <NavLink to={rightHref} className={textClass}>
            {rightLabel}
          </NavLink>
        );
      }

      return (
        <button type="button" className={textClass} onClick={onRightClick}>
          {rightLabel}
        </button>
      );
    }

    if (rightAction === 'icon') {
      const iconClass = `sub-nav-bar-action${rightActive ? ' is-active' : ''}`;

      const icon = RightIcon ? (
        <RightIcon size={ICON_SIZE.toolbar} framed className="sub-nav-bar-action__svg" />
      ) : (
        <span className="material-symbols-outlined">{rightIcon}</span>
      );

      if (rightHref) {
        return (
          <NavLink to={rightHref} className={iconClass} aria-label={rightLabel || 'Thao tác'}>
            {icon}
          </NavLink>
        );
      }

      return (
        <button
          type="button"
          className={iconClass}
          onClick={onRightClick}
          aria-label={rightLabel || 'Thao tác'}
        >
          {icon}
        </button>
      );
    }

    return null;
  };

  return (
    <header className={rootClass}>
      <div className="sub-nav-bar__side sub-nav-bar__side--start">
        {leading}
        {!leading && onBack && (
          <button type="button" className="sub-nav-bar-back" onClick={onBack} aria-label={backLabel}>
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
        )}
        {renderFilter()}
      </div>

      <div className="sub-nav-bar__title">
        {children || (
          <>
            {title && <h2 className="sub-nav-bar__title-text">{title}</h2>}
            {subtitle && <p className="sub-nav-bar__title-sub">{subtitle}</p>}
          </>
        )}
      </div>

      <div className="sub-nav-bar__side sub-nav-bar__side--end">{renderRight()}</div>
    </header>
  );
}

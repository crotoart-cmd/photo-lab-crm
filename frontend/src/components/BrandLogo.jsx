import { BRAND_NAME, BRAND_TAGLINE, LOGO_SRC } from '../config/brand';

/**
 * Logo thương hiệu HDTLabx.
 */
export default function BrandLogo({
  size = 'md',
  showTagline = false,
  className = '',
  onClick,
  'aria-label': ariaLabel,
}) {
  const imgClass =
    size === 'sm' ? 'h-8 w-auto' : size === 'lg' ? 'h-16 w-auto' : 'h-10 w-auto';

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? ariaLabel || `Mở menu ${BRAND_NAME}` : undefined}
      className={[
        'flex flex-col items-start gap-1',
        onClick ? 'ios-header-logo-btn' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img
        src={LOGO_SRC}
        alt={BRAND_NAME}
        className={`${imgClass} object-contain`}
      />
      {showTagline && (
        <p className="text-[10px] text-[var(--color-label-secondary)] uppercase tracking-wide">
          {BRAND_TAGLINE}
        </p>
      )}
    </Tag>
  );
}

export function BrandTitle({ subtitle, className = '' }) {
  return (
    <div className={className}>
      <p className="md-nav-drawer-title">{BRAND_NAME}</p>
      {subtitle && (
        <p className="text-[11px] text-[var(--color-label-secondary)] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

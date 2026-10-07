/**
 * StatusPill — Figma semantic badges
 * success | processing | failed | active | disable
 */

const VARIANTS = {
  success: {
    icon: 'check',
    iconClass: 'status-pill-icon--success',
    labelClass: 'status-pill-label--success',
  },
  processing: {
    icon: 'progress_activity',
    iconClass: 'status-pill-icon--processing',
    labelClass: 'status-pill-label--processing',
  },
  failed: {
    icon: 'close',
    iconClass: 'status-pill-icon--failed',
    labelClass: 'status-pill-label--failed',
  },
  active: {
    icon: 'info',
    iconClass: 'status-pill-icon--active',
    labelClass: 'status-pill-label--active',
  },
  disable: {
    icon: 'block',
    iconClass: 'status-pill-icon--disable',
    labelClass: 'status-pill-label--disable',
  },
};

/** Map toast / legacy variant names */
const VARIANT_ALIAS = {
  error: 'failed',
  info: 'active',
  warning: 'processing',
  disabled: 'disable',
};

export function resolveStatusPillVariant(variant) {
  const key = VARIANT_ALIAS[variant] || variant;
  return VARIANTS[key] ? key : 'active';
}

export default function StatusPill({
  variant = 'active',
  children,
  icon,
  iconOnly = false,
  className = '',
}) {
  const resolved = resolveStatusPillVariant(variant);
  const cfg = VARIANTS[resolved];
  const iconName = icon || cfg.icon;

  return (
    <span
      className={`status-pill status-pill--${resolved}${iconOnly ? ' status-pill--icon-only' : ''} ${className}`.trim()}
    >
      <span className={`status-pill-icon ${cfg.iconClass}`} aria-hidden="true">
        <span className="material-symbols-outlined">{iconName}</span>
      </span>
      {!iconOnly && children != null && children !== '' && (
        <span className={`status-pill-label ${cfg.labelClass}`}>{children}</span>
      )}
    </span>
  );
}

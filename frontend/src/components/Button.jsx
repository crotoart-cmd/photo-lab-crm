/**
 * Button — Figma pill system (lv.1–lv.5) + Actionsample_ rectangular
 *
 * variant: primary(lv1) | outline(lv2) | text(lv3) | neutral(lv4) | ghost(lv5) | action(rect)
 * size: 36 | 40 | 48
 */

const VARIANT_MAP = {
  primary: ['btn-pill', 'btn-pill--lv1'],
  outline: ['btn-pill', 'btn-pill--lv2'],
  secondary: ['btn-pill', 'btn-pill--lv2'],
  text: ['btn-pill', 'btn-pill--lv3'],
  ghost: ['btn-pill', 'btn-pill--lv3'],
  neutral: ['btn-pill', 'btn-pill--lv4'],
  tonal: ['btn-pill', 'btn-pill--lv4'],
  link: ['btn-pill', 'btn-pill--lv5'],
  action: ['action-btn'],
  destructive: ['btn-pill', 'btn-pill--lv3', 'btn-pill--danger'],
};

export default function Button({
  variant = 'primary',
  size = 40,
  block = false,
  iconOnly = false,
  noPadding = false,
  brand = false,
  compact = false,
  className = '',
  type = 'button',
  children,
  ...props
}) {
  const isAction = variant === 'action';
  const sizeClass = isAction ? '' : `btn-pill--${size}`;
  const base = VARIANT_MAP[variant] || VARIANT_MAP.primary;

  const classes = [
    ...base,
    sizeClass,
    !isAction && block && 'btn-pill--block',
    !isAction && iconOnly && 'btn-pill--icon-only',
    !isAction && noPadding && 'btn-pill--pad-none',
    isAction && block && 'action-btn--block',
    isAction && compact && 'action-btn--compact',
    isAction && brand && 'action-btn--brand',
    variant === 'destructive' && 'text-[var(--color-red)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}

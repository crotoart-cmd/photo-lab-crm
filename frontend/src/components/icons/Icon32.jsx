/** Figma 32×32 icon frame — padding theo variant */
export default function Icon32({ variant = 'default', className = '', children, ...props }) {
  const variantClass = variant !== 'default' ? `icon-32--${variant}` : '';
  return (
    <span
      className={['icon-32', variantClass, className].filter(Boolean).join(' ')}
      aria-hidden
      {...props}
    >
      {children}
    </span>
  );
}

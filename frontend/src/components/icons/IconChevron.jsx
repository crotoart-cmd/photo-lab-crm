/** Chevron line — thu gọn / mở rộng (Figma stroke 2.5) */
export default function IconChevron({
  className = '',
  size = 20,
  expanded = false,
  ...props
}) {
  return (
    <svg
      className={['icon-chevron', expanded && 'icon-chevron--expanded', className]
        .filter(Boolean)
        .join(' ')}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path
        d="M10 13L16 19L22 13"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

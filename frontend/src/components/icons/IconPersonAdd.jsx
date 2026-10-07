import Icon32 from './Icon32';

/** Header Khách hàng — user + list (Figma 32×32, padding 3×6) */
export default function IconPersonAdd({ className = '', size = 32, framed = true, ...props }) {
  const svg = (
    <svg
      className={framed ? 'icon-32__svg' : undefined}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="14" cy="9.5" r="4.25" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M13.5 18H12.1667C8.48477 18 5.5 20.9848 5.5 24.6667C5.5 26.5076 6.99238 28 8.83333 28H14.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M26.5 28H21.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26.5 23H19.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26.5 18H17.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="customer" className={className}>
      {svg}
    </Icon32>
  );
}

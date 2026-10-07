import Icon32 from './Icon32';

/** Liên hệ — user + thẻ */
export default function IconContact({ className = '', size = 32, framed = true, ...props }) {
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
      <circle cx="12" cy="11" r="4" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M5.5 24.5C6.2 20.2 8.8 18 12 18C15.2 18 17.8 20.2 18.5 24.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect
        x="19"
        y="8"
        width="8"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path d="M21 12H25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 16H25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 20H23.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="contact" className={className}>
      {svg}
    </Icon32>
  );
}

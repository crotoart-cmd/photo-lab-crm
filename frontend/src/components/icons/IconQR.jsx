import Icon32 from './Icon32';

/** Icon QR — quét mã khách hàng (Figma Size=32, padding 5px) */
export default function IconQR({ className = '', size = 32, framed = true, ...props }) {
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
      <path
        d="M4.99997 21V24C4.99997 25.6569 6.34312 27 7.99997 27H11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M27 21V24C27 25.6569 25.6568 27 24 27H21"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M11 5L7.99997 5C6.34312 5 4.99997 6.34315 4.99997 8L4.99997 11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M21 5L24 5C25.6568 5 27 6.34315 27 8L27 11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="18" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="18" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="17.5833" y="17.5833" width="1.16667" height="1.16667" fill="currentColor" />
      <rect x="17.5833" y="22.25" width="1.16667" height="1.16667" fill="currentColor" />
      <rect x="19.9167" y="19.9166" width="1.16667" height="1.16667" fill="currentColor" />
      <rect x="22.25" y="22.25" width="1.16667" height="1.16667" rx="0.583333" fill="currentColor" />
      <rect x="22.25" y="17.5833" width="1.16667" height="1.16667" fill="currentColor" />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="scan-qr" className={className}>
      {svg}
    </Icon32>
  );
}

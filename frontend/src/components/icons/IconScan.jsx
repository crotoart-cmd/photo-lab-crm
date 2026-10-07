import Icon32 from './Icon32';

/** Quét barcode — khung + vạch mã */
export default function IconScan({ className = '', size = 32, framed = true, ...props }) {
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
        d="M6 10V8C6 6.89543 6.89543 6 8 6H10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M22 6H24C25.1046 6 26 6.89543 26 8V10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M26 22V24C26 25.1046 25.1046 26 24 26H22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M10 26H8C6.89543 26 6 25.1046 6 24V22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M9 13H11V19H9V13Z" fill="currentColor" />
      <path d="M13 11H15V21H13V11Z" fill="currentColor" />
      <path d="M17 13H19V19H17V13Z" fill="currentColor" />
      <path d="M21 12H23V20H21V12Z" fill="currentColor" />
      <path
        d="M5 16H27"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="scan" className={className}>
      {svg}
    </Icon32>
  );
}

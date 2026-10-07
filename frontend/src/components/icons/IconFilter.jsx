import Icon32 from './Icon32';

export default function IconFilter({ className = '', size = 32, framed = true, ...props }) {
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
        d="M6 9H26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M10 16H22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M14 23H18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="9" r="2" fill="currentColor" />
      <circle cx="12" cy="16" r="2" fill="currentColor" />
      <circle cx="16" cy="23" r="2" fill="currentColor" />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="filter" className={className}>
      {svg}
    </Icon32>
  );
}

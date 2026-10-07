import Icon32 from './Icon32';

export default function IconLoading({ className = '', size = 32, framed = true, ...props }) {
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
        d="M27 16C27 22.0751 22.0751 27 16 27"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path
        d="M5 16C5 9.92487 9.92487 5 16 5"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        opacity="0.28"
      />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="loading" className={className}>
      {svg}
    </Icon32>
  );
}

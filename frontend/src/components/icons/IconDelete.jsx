import Icon32 from './Icon32';

export default function IconDelete({ className = '', size = 32, framed = true, ...props }) {
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
        d="M10 12.5V24.5C10 25.3284 10.6716 26 11.5 26H20.5C21.3284 26 22 25.3284 22 24.5V12.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M8 8.5H24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M13 8.5V7C13 6.44772 13.4477 6 14 6H18C18.5523 6 19 6.44772 19 7V8.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M13.5 15V21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18.5 15V21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="delete" className={className}>
      {svg}
    </Icon32>
  );
}

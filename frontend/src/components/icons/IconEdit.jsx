import Icon32 from './Icon32';

export default function IconEdit({ className = '', size = 32, framed = true, ...props }) {
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
        d="M19.2 6.8L25.2 12.8L11.5 26.5H5.5V20.5L19.2 6.8Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M17.2 8.8L23.2 14.8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="edit" className={className}>
      {svg}
    </Icon32>
  );
}

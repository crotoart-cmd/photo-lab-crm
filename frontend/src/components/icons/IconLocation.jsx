import Icon32 from './Icon32';

export default function IconLocation({ className = '', size = 32, framed = true, ...props }) {
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
        d="M16 27C16 27 24 20.5 24 13.5C24 9.35786 20.6421 6 16.5 6H15.5C11.3579 6 8 9.35786 8 13.5C8 20.5 16 27 16 27Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13.5" r="3" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="location" className={className}>
      {svg}
    </Icon32>
  );
}

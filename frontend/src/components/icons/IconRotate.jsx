import Icon32 from './Icon32';
import { ROTATE_ACCENT, ROTATE_COLORS, ROTATE_NEUTRAL } from './iconRotatePaths';

/**
 * Icons/Rotate — Figma 32×32 stroke (Property 1=32 stroke)
 * Một SVG duy nhất — không bọc thêm lớp icon khác.
 */
export default function IconRotate({ className = '', size, framed = false, ...props }) {
  const sizeProps = size != null ? { width: size, height: size } : {};

  const svg = (
    <svg
      {...sizeProps}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={['icon-rotate__svg', framed ? 'icon-32__svg' : '', className].filter(Boolean).join(' ')}
      aria-hidden
      {...props}
    >
      <path
        d={ROTATE_NEUTRAL.arc}
        stroke={ROTATE_COLORS.neutral}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={ROTATE_NEUTRAL.arrow}
        stroke={ROTATE_COLORS.neutral}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={ROTATE_ACCENT.arc}
        stroke={ROTATE_COLORS.accent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={ROTATE_ACCENT.arrow}
        stroke={ROTATE_COLORS.accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!framed) return svg;
  return (
    <Icon32 variant="rotate" className={className}>
      {svg}
    </Icon32>
  );
}

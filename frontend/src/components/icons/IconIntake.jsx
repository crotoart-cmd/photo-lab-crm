/** Tab Nhập — nhập hàng / intake (Figma 32×32, currentColor) */
export default function IconIntake({ className = '', size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        d="M12 12C12 14.2091 10.2091 16 8 16C5.79086 16 4 14.2091 4 12"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M20 12C20 14.2091 18.2091 16 16 16C13.7909 16 12 14.2091 12 12"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M28 11.9997C28 14.2088 26.2091 15.9997 24 15.9997C21.7909 15.9997 20 14.2088 20 11.9997V5.33301H12"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M4 11.9997L5.99615 7.0093C6.40112 5.99688 7.38168 5.33301 8.47209 5.33301H12V11.9997"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M28 11.9997L26.0038 7.0093C25.5989 5.99688 24.6183 5.33301 23.5279 5.33301H20V11.9997"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M5.3335 16V22.6667C5.3335 24.8758 7.12436 26.6667 9.3335 26.6667H22.6668C24.876 26.6667 26.6668 24.8758 26.6668 22.6667V16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <path
        d="M13.3335 26.6667V16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <circle cx="10.3335" cy="21" r="1" fill="currentColor" />
    </svg>
  );
}

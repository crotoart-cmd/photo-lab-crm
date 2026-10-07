/** Wrapper nội dung trang — căn max-width iPhone 14 Pro Max trên mobile */
export default function IosPage({ children, className = '' }) {
  return <div className={`ios-page ${className}`.trim()}>{children}</div>;
}

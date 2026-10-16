export default function PublicMobileIcon({ name, className = '' }) {
  return <span className={`material-symbols-outlined pm-icon ${className}`} aria-hidden="true">{name}</span>;
}

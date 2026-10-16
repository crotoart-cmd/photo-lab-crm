import { PUBLIC_MOBILE_ICONS } from '../../lib/publicMobileIcons';

export default function PublicMobileIcon({ name, className = '' }) {
  const Icon = PUBLIC_MOBILE_ICONS[name];
  if (!Icon) {
    return <span className={`material-symbols-outlined pm-icon ${className}`} aria-hidden="true">{name}</span>;
  }
  return (
    <span className={`pm-icon pm-icon--vector ${className}`} aria-hidden="true" data-icon={name} data-icon-family="lucide">
      <Icon size={24} strokeWidth={1.8} focusable="false" />
    </span>
  );
}

import { Link } from 'react-router-dom';
import { BRAND_NAME, LOGO_SRC } from '../../config/brand';
import { usePublicLocale } from './PublicLocale';

export default function PublicMobileBrand({ to = '/' }) {
  const { t } = usePublicLocale();
  const src = new URL(LOGO_SRC, new URL(import.meta.env.BASE_URL, window.location.href)).href;
  return <Link to={to} className="pm-mobile-brand" aria-label={t('mpage.home')}>
    <img src={src} alt={BRAND_NAME} width="156" height="26" referrerPolicy="no-referrer" />
  </Link>;
}

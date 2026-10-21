import { useId } from 'react';
import { Link } from 'react-router-dom';
import { PATH } from '../../config/publicPaths';
import { MOBILE_FILM_SERVICES } from '../../config/publicMobileNavigation';
import { usePublicLocale } from './PublicLocale';
import PublicMobileIcon from './PublicMobileIcon';

export default function PublicMobileFilmServices({ intakeLink = false }) {
  const { t } = usePublicLocale();
  const titleId = useId();
  return (
    <section className="pm-film-services" aria-labelledby={titleId}>
      <div className="pm-section-heading">
        <h2 id={titleId}>{t('nav.film')}</h2>
        {intakeLink ? <Link to={PATH.film} className="pm-section-more">{t('home.doorFilm')}<PublicMobileIcon name="arrow_forward" /></Link> : <span>135 / 120</span>}
      </div>
      <nav aria-labelledby={titleId}>
        {MOBILE_FILM_SERVICES.map((service) => (
          <Link key={service.to} to={service.to} className="pm-film-service">
            <PublicMobileIcon name={service.icon} />
            <span className="pm-film-service-copy"><b>{t(service.key)}</b><small>{t(service.hint)}</small></span>
            <PublicMobileIcon name="chevron_right" />
          </Link>
        ))}
      </nav>
    </section>
  );
}

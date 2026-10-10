import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PublicFilmIntakeForm from '../components/public/PublicFilmIntakeForm';

export default function PublicFilm() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('film.h1')}</h1>
        <p className="ps-lede">{t('film.lede')}</p>
        <div className="ps-hero-actions">
          <a href="#gui-don" className="ps-cta">
            {t('cta.sendDev')}
          </a>
          <Link to="/toc-do" className="ps-cta">
            {t('cta.viewSpeed')}
          </Link>
        </div>
      </section>

      <div className="ps-body ps-grid">
        <section className="ps-section ps-prose">
          <h2>{t('film.bwH')}</h2>
          <p>{t('film.bwP')}</p>
        </section>
        <section className="ps-section ps-prose">
          <h2>{t('film.c41H')}</h2>
          <p>{t('film.c41P')}</p>
        </section>
        <PublicFilmIntakeForm />
      </div>
    </PsPage>
  );
}

import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';

export default function PublicContact() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.lab')}</p>
        <h1>{t('contact.h1')}</h1>
        <p className="ps-lede">{t('contact.lede')}</p>
        <div className="ps-hero-actions">
          <Link to="/film" className="ps-cta ps-cta--fill">
            {t('contact.ctaFilm')}
          </Link>
          <Link to="/sua-may" className="ps-cta">
            {t('contact.ctaRepair')}
          </Link>
        </div>
      </section>
      <div className="ps-body ps-grid">
        <section className="ps-section ps-prose">
          <h2>{t('contact.h2')}</h2>
          <p>{t('contact.p')}</p>
          <ul className="ps-list">
            <li>{t('contact.li1')}</li>
            <li>{t('contact.li2')}</li>
            <li>{t('contact.li3')}</li>
          </ul>
        </section>
        <section className="ps-section ps-prose">
          <h2>{t('contact.h2b')}</h2>
          <p>{t('contact.p2')}</p>
        </section>
        <section className="ps-section ps-prose">
          <h2>{t('contact.h2c')}</h2>
          <p>{t('contact.p3')}</p>
          <p className="ps-note">{t('contact.help')}</p>
        </section>
      </div>
    </PsPage>
  );
}

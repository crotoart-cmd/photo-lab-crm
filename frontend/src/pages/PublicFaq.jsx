import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';

const ITEMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default function PublicFaq() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.lab')}</p>
        <h1>{t('faq.h1')}</h1>
        <p className="ps-lede">{t('faq.lede')}</p>
        <div className="ps-hero-actions">
          <Link to="/film" className="ps-cta ps-cta--fill">
            {t('faq.ctaFilm')}
          </Link>
          <Link to="/lien-he" className="ps-cta">
            {t('faq.ctaContact')}
          </Link>
        </div>
      </section>
      <div className="ps-body ps-grid">
        <section className="ps-section">
          <h2>{t('faq.h2')}</h2>
          <div className="ps-faq">
            {ITEMS.map((n) => (
              <details key={n}>
                <summary>{t(`faq.q${n}`)}</summary>
                <p>{t(`faq.a${n}`)}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PsPage>
  );
}

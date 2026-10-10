import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';

const CATS = [
  { id: 'c1', tone: 'film' },
  { id: 'c2', tone: 'speed' },
  { id: 'c3', tone: 'print' },
  { id: 'c4', tone: 'scan' },
];

export default function PublicAccessories() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.lab')}</p>
        <h1>{t('acc.h1')}</h1>
        <p className="ps-lede">{t('acc.lede')}</p>
        <div className="ps-hero-actions">
          <Link to="/lien-he" className="ps-cta ps-cta--fill">
            {t('acc.ctaShop')}
          </Link>
          <Link to="/film" className="ps-cta">
            {t('acc.ctaFilm')}
          </Link>
        </div>
      </section>

      <div className="ps-body ps-grid">
        <p className="ps-note">{t('acc.soon')}</p>
        <div className="ps-tiles">
          {CATS.map((cat) => (
            <div key={cat.id} className="ps-tile ps-tile--disabled" aria-disabled="true">
              <div className={`ps-tile-photo ps-tile-photo--${cat.tone}`} aria-hidden />
              <h3 className="ps-tile-title">{t(`acc.${cat.id}h`)}</h3>
              <div className="ps-tile-fields">
                <div>
                  <b>{t('work.note')}</b>
                  <span>{t(`acc.${cat.id}p`)}</span>
                </div>
                <div>
                  <b>{t('work.status')}</b>
                  <span>{t('work.soon')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <section className="ps-section ps-prose">
          <h2>{t('acc.keepH')}</h2>
          <p>{t('acc.keepP')}</p>
          <ul className="ps-list">
            <li>{t('acc.li1')}</li>
            <li>{t('acc.li2')}</li>
            <li>{t('acc.li3')}</li>
            <li>{t('acc.li4')}</li>
          </ul>
        </section>
      </div>
    </PsPage>
  );
}

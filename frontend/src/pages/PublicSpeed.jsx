import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import { PublicMobileSpeed } from '../components/public/PublicMobileService';
import { LAB_PHOTO } from '../data/publicLabPhotos';
import { SPEED_STANDARD } from '../data/publicLabServices';

const TIME_KEY = {
  '2 tuần': 'time.2w',
};

export default function PublicSpeed() {
  const { t } = usePublicLocale();
  const time = (raw) => t(TIME_KEY[raw] || raw);
  return (
    <>
    <PublicMobileSpeed />
    <div className="ps-desk">
    <PsPage>
      <section className="ps-page-hero ps-page-hero--photo ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('speed.h1')}</h1>
        <p className="ps-lede">{t('speed.lede')}</p>
        <PsPhoto src={LAB_PHOTO.speed} tone="speed" className="ps-page-banner" alt="" />
      </section>

      <div className="ps-body ps-grid">
        <section className="ps-section ps-prose">
          <h2>{t('speed.whyH')}</h2>
          <p>{t('speed.whyP')}</p>
          <p className="ps-note">{t('speed.sunday')}</p>
        </section>

        <section className="ps-section">
          <h2>{t('speed.devScan')}</h2>
          <table className="ps-table">
            <thead>
              <tr>
                <th>{t('speed.process')}</th>
                <th>{t('speed.std')}</th>
              </tr>
            </thead>
            <tbody>
              {SPEED_STANDARD.map((row) => (
                <tr key={row.process}>
                  <td>{row.process}</td>
                  <td>{time(row.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ps-section ps-prose">
          <h2>{t('speed.express')}</h2>
          <p>{t('speed.rushOff')}</p>
        </section>

        <section className="ps-section">
          <h2>{t('speed.store')}</h2>
          <ul className="ps-list">
            <li>{t('speed.neg')}</li>
            <li>{t('speed.link')}</li>
            <li>{t('speed.print')}</li>
          </ul>
        </section>
      </div>
    </PsPage>
    </div>
    </>
  );
}

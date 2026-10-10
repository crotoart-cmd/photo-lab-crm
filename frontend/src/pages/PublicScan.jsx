import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';

export default function PublicScan() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('scan.h1')}</h1>
        <p className="ps-lede">{t('scan.lede')}</p>
      </section>

      <div className="ps-body ps-grid">
        <section className="ps-section ps-prose">
          <h2>{t('scan.hiH')}</h2>
          <p>{t('scan.hiP')}</p>
          <p className="ps-note">{t('scan.hiN')}</p>
        </section>

        <section className="ps-section ps-prose">
          <h2>{t('scan.batchH')}</h2>
          <p>{t('scan.batchP1')}</p>
          <p>{t('scan.batchP2')}</p>
          <ul className="ps-list">
            <li>{t('scan.li1')}</li>
            <li>{t('scan.li2')}</li>
            <li>{t('scan.li3')}</li>
          </ul>
        </section>
      </div>
    </PsPage>
  );
}

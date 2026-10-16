import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import { PublicMobileScan } from '../components/public/PublicMobileService';
import { LAB_PHOTO } from '../data/publicLabPhotos';

export default function PublicScan() {
  const { t } = usePublicLocale();
  return (
    <>
    <PublicMobileScan />
    <div className="ps-desk">
    <PsPage>
      <section className="ps-page-hero ps-page-hero--photo ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('scan.h1')}</h1>
        <p className="ps-lede">{t('scan.lede')}</p>
        <PsPhoto src={LAB_PHOTO.scan} tone="scan" className="ps-page-banner" alt="" />
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
    </div>
    </>
  );
}

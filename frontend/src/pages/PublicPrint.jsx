import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import { LAB_PHOTO } from '../data/publicLabPhotos';

export default function PublicPrint() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-page-hero--photo ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('print.h1')}</h1>
        <p className="ps-lede">{t('print.lede')}</p>
        <PsPhoto src={LAB_PHOTO.print} tone="print" className="ps-page-banner" alt="" />
      </section>

      <div className="ps-body ps-grid">
        <section className="ps-section ps-prose">
          <h2>{t('print.h2')}</h2>
          <p>{t('print.p')}</p>
        </section>
      </div>
    </PsPage>
  );
}

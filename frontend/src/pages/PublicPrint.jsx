import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';

export default function PublicPrint() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('print.h1')}</h1>
        <p className="ps-lede">{t('print.lede')}</p>
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

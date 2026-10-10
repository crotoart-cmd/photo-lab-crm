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
      </section>
      <div className="ps-body ps-grid">
        <section className="ps-section ps-prose">
          <h2>{t('contact.h2')}</h2>
          <p>{t('contact.p')}</p>
        </section>
      </div>
    </PsPage>
  );
}

import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import PublicPrintIntakeForm from '../components/public/PublicPrintIntakeForm';
import { PublicMobilePrint } from '../components/public/PublicMobileService';
import { LAB_PHOTO } from '../data/publicLabPhotos';
import { PATH } from '../config/publicPaths';

export default function PublicPrint() {
  const { t } = usePublicLocale();
  const steps = [
    { n: '01', t: t('print.s1') },
    { n: '02', t: t('print.s2') },
    { n: '03', t: t('print.s3') },
  ];
  const faqs = [
    { q: t('print.q1'), a: t('print.a1') },
    { q: t('print.q2'), a: t('print.a2') },
    { q: t('print.q3'), a: t('print.a3') },
    { q: t('print.q4'), a: t('print.a4') },
  ];

  return (
    <>
      <PublicMobilePrint />
      <div className="ps-desk">
        <PsPage>
          <section className="ps-page-hero ps-page-hero--photo ps-grid">
            <p className="ps-kicker">{t('kicker.service')}</p>
            <h1>{t('print.h1')}</h1>
            <p className="ps-lede">{t('print.lede')}</p>
            <PsPhoto src={LAB_PHOTO.print} tone="print" className="ps-page-banner" alt="" />
            <div className="ps-hero-actions">
              <a href="#gui-don" className="ps-cta">
                {t('cta.sendPrint')}
              </a>
              <Link to={PATH.film} className="ps-cta">
                {t('cta.devFilm')}
              </Link>
            </div>
          </section>

          <div className="ps-body ps-grid">
            <ol className="ps-steps">
              {steps.map((s) => (
                <li key={s.n}>
                  <b>
                    {t('print.step')} {s.n}
                  </b>
                  <span>{s.t}</span>
                </li>
              ))}
            </ol>

            <section className="ps-section ps-prose">
              <h2>{t('print.howH')}</h2>
              <p>{t('print.howP')}</p>
            </section>

            <section className="ps-section ps-prose">
              <h2>{t('print.h2')}</h2>
              <p>{t('print.p')}</p>
            </section>

            <section className="ps-section">
              <h2>{t('repair.faqH')}</h2>
              <div className="ps-faq">
                {faqs.map((item) => (
                  <details key={item.q}>
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
            <PublicPrintIntakeForm />
          </div>
        </PsPage>
      </div>
    </>
  );
}

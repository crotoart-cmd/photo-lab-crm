import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import PublicScanIntakeForm from '../components/public/PublicScanIntakeForm';
import { PublicMobileScan } from '../components/public/PublicMobileService';
import { LAB_PHOTO } from '../data/publicLabPhotos';
import { PATH } from '../config/publicPaths';

export default function PublicScan() {
  const { t } = usePublicLocale();
  const steps = [
    { n: '01', t: t('scan.s1') },
    { n: '02', t: t('scan.s2') },
    { n: '03', t: t('scan.s3') },
  ];
  const faqs = [
    { q: t('scan.q1'), a: t('scan.a1') },
    { q: t('scan.q2'), a: t('scan.a2') },
    { q: t('scan.q3'), a: t('scan.a3') },
    { q: t('scan.q4'), a: t('scan.a4') },
  ];

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
            <div className="ps-hero-actions">
              <a href="#gui-don" className="ps-cta">
                {t('cta.sendScan')}
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
                    {t('scan.step')} {s.n}
                  </b>
                  <span>{s.t}</span>
                </li>
              ))}
            </ol>

            <section className="ps-section ps-prose">
              <h2>{t('scan.howH')}</h2>
              <p>{t('scan.howP')}</p>
            </section>

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
            <PublicScanIntakeForm />
          </div>
        </PsPage>
      </div>
    </>
  );
}

import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PublicRepairIntakeForm from '../components/public/PublicRepairIntakeForm';

export default function PublicRepair() {
  const { t } = usePublicLocale();
  const steps = [
    { n: '01', t: t('repair.s1') },
    { n: '02', t: t('repair.s2') },
    { n: '03', t: t('repair.s3') },
  ];
  const faqs = [
    { q: t('repair.q1'), a: t('repair.a1') },
    { q: t('repair.q2'), a: t('repair.a2') },
    { q: t('repair.q3'), a: t('repair.a3') },
    { q: t('repair.q4'), a: t('repair.a4') },
  ];

  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.service')}</p>
        <h1>{t('repair.h1')}</h1>
        <p className="ps-lede">{t('repair.lede')}</p>
        <div className="ps-hero-actions">
          <a href="#gui-don" className="ps-cta">
            {t('cta.sendRepair')}
          </a>
          <Link to="/film" className="ps-cta">
            {t('cta.devFilm')}
          </Link>
        </div>
      </section>

      <div className="ps-body ps-grid">
        <ol className="ps-steps">
          {steps.map((s) => (
            <li key={s.n}>
              <b>
                {t('repair.step')} {s.n}
              </b>
              <span>{s.t}</span>
            </li>
          ))}
        </ol>

        <section className="ps-section ps-prose">
          <h2>{t('repair.quoteH')}</h2>
          <p>{t('repair.quoteP')}</p>
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
        <PublicRepairIntakeForm />
      </div>
    </PsPage>
  );
}

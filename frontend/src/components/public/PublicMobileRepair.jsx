import { Link } from 'react-router-dom';
import { LAB_PHOTO } from '../../data/publicLabPhotos';
import { PATH } from '../../config/publicPaths';
import PublicRepairIntakeForm from './PublicRepairIntakeForm';
import { usePublicLocale } from './PublicLocale';
import PublicMobileIcon from './PublicMobileIcon';
import {
  PublicMobileGroup,
  PublicMobilePage,
  PublicMobileRowLink,
} from './PublicMobilePage';

export default function PublicMobileRepair() {
  const { t } = usePublicLocale();
  const faqs = [
    { q: t('repair.q1'), a: t('repair.a1') },
    { q: t('repair.q2'), a: t('repair.a2') },
    { q: t('repair.q3'), a: t('repair.a3') },
    { q: t('repair.q4'), a: t('repair.a4') },
  ];
  return (
    <PublicMobilePage>
      <section className="pm-repair-hero">
        <div className="pm-repair-hero-heading"><p className="pm-eyebrow">CAMERA REPAIR / HDTLABX</p><h1>{t('rp.title')}</h1><p>{t('rp.spec')}</p></div>
        <div className="pm-repair-hero-visual"><img src={LAB_PHOTO.repair} alt="Contax" className="pm-repair-hero-photo" /></div>
        <a href="#mobile-repair-intake" className="pm-primary">{t('rp.cta')}<PublicMobileIcon name="arrow_downward" /></a>
      </section>
      <div className="pm-repair-promise"><PublicMobileIcon name="verified_user" /><span><b>{t('rp.promise')}</b><small>{t('rp.promiseBody')}</small></span></div>
      <PublicRepairIntakeForm compact />
      <section className="pm-repair-process" aria-labelledby="repair-process-title">
        <div className="pm-section-heading"><h2 id="repair-process-title">{t('rp.process')}</h2><span>01 / 03</span></div>
        <ol>{[1, 2, 3].map((number) => <li key={number}><span>{String(number).padStart(2, '0')}</span><div><h3>{t(`rp.process.${number}`)}</h3><p>{t(`repair.s${number}`)}</p></div><PublicMobileIcon name={['inventory_2', 'mark_email_read', 'build'][number - 1]} /></li>)}</ol>
      </section>
      <section className="pm-repair-faq" aria-labelledby="repair-faq-title">
        <div className="pm-section-heading"><h2 id="repair-faq-title">{t('repair.faqH')}</h2><PublicMobileIcon name="help_outline" /></div>
        {faqs.map((item) => (
          <details key={item.q} className="ps-mdetail">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
      <Link to={PATH.contact} className="pm-repair-contact"><PublicMobileIcon name="chat_bubble_outline" /><span><b>{t('mpage.needHelp')}</b><small>{t('nav.contact')}</small></span><PublicMobileIcon name="arrow_forward" /></Link>
      <PublicMobileGroup>
        <PublicMobileRowLink to="/film" title={t('home.doorFilm')} hint={t('home.doorFilmSub')} />
      </PublicMobileGroup>
    </PublicMobilePage>
  );
}

import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';

const POSTS = ['p1', 'p2', 'p3'];

export default function PublicBlog() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-page-hero ps-grid">
        <p className="ps-kicker">{t('kicker.lab')}</p>
        <h1>{t('blog.h1')}</h1>
        <p className="ps-lede">{t('blog.lede')}</p>
        <div className="ps-hero-actions">
          <Link to="/film" className="ps-cta ps-cta--fill">
            {t('blog.cta')}
          </Link>
          <Link to="/faq" className="ps-cta">
            {t('nav.faq')}
          </Link>
        </div>
      </section>
      <div className="ps-body ps-grid">
        {POSTS.map((id) => (
          <section key={id} className="ps-section ps-prose">
            <p className="ps-kicker">{t(`blog.${id}d`)}</p>
            <h2>{t(`blog.${id}h`)}</h2>
            <p>{t(`blog.${id}p`)}</p>
          </section>
        ))}
      </div>
    </PsPage>
  );
}

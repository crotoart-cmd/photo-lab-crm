import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import { loadPublicContent } from '../lib/publicContent';
import { fallbackBlogPosts, remoteBlogPosts } from '../lib/publicBlog';
import { PublicMobileBlog } from '../components/public/PublicMobileMore';

export default function PublicBlog() {
  const { t, lang } = usePublicLocale();
  const [filter, setFilter] = useState('all');
  const [remote, setRemote] = useState([]);

  useEffect(() => {
    loadPublicContent().then((data) => setRemote(data.blog || []));
  }, []);

  const posts = useMemo(
    () => (remote.length ? remoteBlogPosts(remote, t, lang) : fallbackBlogPosts(t)),
    [remote, t, lang]
  );

  const kinds = [...new Set(posts.map((p) => p.kind).filter(Boolean))];
  const items = filter === 'all' ? posts : posts.filter((p) => p.kind === filter);

  return (
    <>
    <PublicMobileBlog posts={items} filter={filter} setFilter={setFilter} kinds={kinds} />
    <div className="ps-desk">
    <PsPage>
      <section className="ps-index">
        <header className="ps-index-head ps-grid">
          <h1>{t('blog.h1')}</h1>
          <p className="ps-label ps-index-side">{t('blog.side')}</p>
        </header>
        <div className="ps-index-bar ps-grid">
          <div className="ps-index-filters">
            <button
              type="button"
              className={filter === 'all' ? 'is-on' : undefined}
              onClick={() => setFilter('all')}
            >
              {t('blog.all')}
            </button>
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className={filter === kind ? 'is-on' : undefined}
                onClick={() => setFilter(kind)}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
        <div className="ps-index-grid-wrap ps-grid">
          <div className="ps-index-grid">
            {items.map((post) => (
              <Link key={post.id} to={post.href} className="ps-index-card">
                <PsPhoto src={post.image} tone={post.tone} className="ps-index-photo" alt={post.title} />
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
                <div className="ps-index-meta">
                  <span className="ps-label">{post.kind}</span>
                  <span className="ps-label">{post.date}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PsPage>
    </div>
    </>
  );
}

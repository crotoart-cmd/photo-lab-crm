import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import { loadPublicContent } from '../lib/publicContent';
import {
  fallbackBlogPosts,
  findBlogPost,
  parsePostBody,
  remoteBlogPosts,
} from '../lib/publicBlog';

export default function PublicBlogPost() {
  const { slug } = useParams();
  const { t, lang } = usePublicLocale();
  const [remote, setRemote] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPublicContent()
      .then((data) => setRemote(data.blog || []))
      .finally(() => setReady(true));
  }, []);

  const posts = useMemo(
    () => (remote.length ? remoteBlogPosts(remote, t, lang) : fallbackBlogPosts(t)),
    [remote, t, lang]
  );
  const post = findBlogPost(posts, slug);
  const related = posts.filter((p) => p.slug !== post?.slug).slice(0, 3);
  const blocks = parsePostBody(post?.body || '');

  if (ready && !post) return <Navigate to="/blog" replace />;

  if (!post) {
    return (
      <PsPage>
        <section className="ps-index" />
      </PsPage>
    );
  }

  return (
    <PsPage>
      <section className="ps-post-hero">
        <PsPhoto src={post.image} tone={post.tone} className="ps-post-hero-photo" alt={post.title} />
      </section>

      <header className="ps-post-head ps-grid">
        <h1>{post.title}</h1>
      </header>

      <div className="ps-post-meta-wrap ps-grid">
        <div className="ps-post-meta">
          <div>
            <span className="ps-label">{t('blog.cat')}</span>
            <p>{post.kind}</p>
          </div>
          <div>
            <span className="ps-label">{t('blog.pub')}</span>
            <p>{post.dateLong || post.date}</p>
          </div>
          <div>
            <span className="ps-label">{t('blog.by')}</span>
            <p>{post.author}</p>
          </div>
          <div>
            <span className="ps-label">{t('blog.more')}</span>
            <p>
              <Link to="/blog">{t('blog.all')}</Link>
            </p>
          </div>
        </div>
      </div>

      <article className="ps-post-body ps-grid">
        {blocks.map((block, i) =>
          block.type === 'h' ? (
            <div key={i} className="ps-post-block">
              <h2>{block.heading}</h2>
              {block.text ? <p>{block.text}</p> : null}
            </div>
          ) : (
            <p key={i} className="ps-post-block">
              {block.text}
            </p>
          )
        )}
      </article>

      {related.length ? (
        <section className="ps-index ps-post-related">
          <header className="ps-index-head ps-grid">
            <h2 className="ps-post-related-h">{t('blog.related')}</h2>
          </header>
          <div className="ps-index-grid-wrap ps-grid">
            <div className="ps-index-grid">
              {related.map((item) => (
                <Link key={item.id} to={item.href} className="ps-index-card">
                  <PsPhoto src={item.image} tone={item.tone} className="ps-index-photo" alt={item.title} />
                  <h2>{item.title}</h2>
                  <p>{item.excerpt}</p>
                  <div className="ps-index-meta">
                    <span className="ps-label">{item.kind}</span>
                    <span className="ps-label">{item.date}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </PsPage>
  );
}

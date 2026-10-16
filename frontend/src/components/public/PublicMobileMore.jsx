import { Link } from 'react-router-dom';
import { PATH } from '../../config/publicPaths';
import PsPhoto from './PsPhoto';
import { usePublicLocale } from './PublicLocale';
import {
  PublicMobileCta,
  PublicMobileGroup,
  PublicMobilePage,
  PublicMobileRowLink,
  PublicMobileStat,
  PublicMobileTitle,
} from './PublicMobilePage';

const FAQ_ITEMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export function PublicMobileContact() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage back="/">
      <PublicMobileTitle title={t('contact.h1')} spec={t('contact.lede')} />
      <PublicMobileGroup>
        <PublicMobileStat title={t('contact.h2')} hint={t('contact.li1')} />
        <PublicMobileStat title={t('nav.speed')} hint={t('contact.li2')} />
        <PublicMobileStat title={t('contact.h2b')} hint={t('contact.p2')} />
      </PublicMobileGroup>
      <PublicMobileGroup>
        <PublicMobileRowLink to="/film" title={t('home.doorFilm')} hint={t('home.doorFilmSub')} />
        <PublicMobileRowLink to={PATH.repair} title={t('home.doorRepair')} hint={t('home.doorRepairSub')} />
        <PublicMobileRowLink to="/faq" title={t('nav.faq')} hint={t('faq.lede')} />
      </PublicMobileGroup>
      <p className="ps-mnote">{t('contact.p3')}</p>
      <p className="ps-mnote">{t('contact.help')}</p>
    </PublicMobilePage>
  );
}

export function PublicMobileFaq() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage back="/">
      <PublicMobileTitle title={t('faq.h1')} spec={t('faq.lede')} />
      <PublicMobileGroup>
        {FAQ_ITEMS.map((n) => (
          <details key={n} className="ps-mdetail">
            <summary>{t(`faq.q${n}`)}</summary>
            <p>{t(`faq.a${n}`)}</p>
          </details>
        ))}
      </PublicMobileGroup>
      <PublicMobileCta to="/film" fill>
        {t('home.doorFilm')}
      </PublicMobileCta>
      <PublicMobileCta to={PATH.contact}>{t('nav.contact')}</PublicMobileCta>
    </PublicMobilePage>
  );
}

export function PublicMobileBlog({ posts, filter, setFilter, kinds }) {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage back="/">
      <PublicMobileTitle title={t('blog.h1')} spec={t('blog.lede')} />
      <div className="ps-mchips ps-mchips--scroll">
        <button type="button" className={filter === 'all' ? 'is-on' : undefined} onClick={() => setFilter('all')}>
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
      {posts.map((post) => (
        <Link key={post.id} to={post.href} className="ps-mpro-story">
          <PsPhoto src={post.image} tone={post.tone || 'film'} className="ps-mpro-story-photo" alt="" />
          <span>
            <p className="ps-mpro-kicker">{post.kind}</p>
            <b>{post.title}</b>
          </span>
        </Link>
      ))}
    </PublicMobilePage>
  );
}

export function PublicMobilePost({ post, related, blocks }) {
  const { t } = usePublicLocale();
  if (!post) {
    return <PublicMobilePage back="/blog" />;
  }
  return (
    <PublicMobilePage back="/blog">
      <PublicMobileTitle title={post.title} spec={post.kind} />
      <PsPhoto src={post.image} tone={post.tone || 'film'} className="ps-mphoto" alt="" />
      <p className="ps-mnote">
        {post.dateLong || post.date}
        {post.author ? ` · ${post.author}` : ''}
      </p>
      <article className="ps-mprose">
        {blocks.map((block, i) =>
          block.type === 'h' ? (
            <div key={i}>
              <h2>{block.heading}</h2>
              {block.text ? <p>{block.text}</p> : null}
            </div>
          ) : (
            <p key={i}>{block.text}</p>
          )
        )}
      </article>
      {related.length ? (
        <PublicMobileGroup>
          {related.map((item) => (
            <PublicMobileRowLink key={item.id} to={item.href} title={item.title} hint={item.kind} />
          ))}
        </PublicMobileGroup>
      ) : null}
      <PublicMobileCta to="/blog">{t('blog.all')}</PublicMobileCta>
    </PublicMobilePage>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PsGridFrame from '../components/public/PsGridFrame';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import { LAB_PHOTO } from '../data/publicLabPhotos';
import { SERVICE_TILES } from '../data/publicLabServices';
import { PATH } from '../config/publicPaths';
import publicApi from '../api/publicClient';
import { loadPublicContent } from '../lib/publicContent';
import { fallbackBlogPosts, remoteBlogPosts } from '../lib/publicBlog';
import { formatShopPublicPrice } from '../lib/shopFx';
import PublicMobileHome from '../components/public/PublicMobileHome';

const FEATURED_IDS = ['trang', 'toc-do', 'scan', 'in-analog'];
const FEATURED = FEATURED_IDS.map((id) => SERVICE_TILES.find((tile) => tile.id === id)).filter(Boolean);

function workSlides(tiles) {
  return tiles.flatMap((tile) => {
    const shots = LAB_PHOTO.work[tile.id] || [''];
    return shots.map((src, i) => ({
      tile,
      src,
      plate: i,
      plateCount: shots.length,
    }));
  });
}

const ACC_CARDS = [
  { id: 'c1', tone: 'film' },
  { id: 'c2', tone: 'speed' },
  { id: 'c3', tone: 'print' },
  { id: 'c4', tone: 'scan' },
];
function PagerArrow({ back }) {
  return (
    <svg viewBox="0 0 18 8" aria-hidden>
      {back ? (
        <>
          <polyline points="5.2,0.6 1.9,4 5.2,7.3" fill="none" stroke="currentColor" />
          <line x1="18" y1="4" x2="1.9" y2="4" stroke="currentColor" />
        </>
      ) : (
        <>
          <polyline points="12.8,0.6 16.1,4 12.8,7.3" fill="none" stroke="currentColor" />
          <line x1="0" y1="4" x2="16.1" y2="4" stroke="currentColor" />
        </>
      )}
    </svg>
  );
}

function FeaturedWork({ tiles }) {
  const { t } = usePublicLocale();
  const slides = workSlides(tiles);
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)] || { tile: tiles[0], src: '', plate: 0, plateCount: 1 };
  const tile = slide.tile;
  const title = t(`svc.${tile.id}.title`);
  const status = tile.enabled ? t('work.open') : t('work.soon');
  const peek = slides[(index + 1) % slides.length];
  const shotClass = 'ps-work-shot ps-work-shot--main';

  return (
    <article className={`ps-work${tile.enabled ? '' : ' ps-work--off'}`}>
      <div className="ps-work-copy">
        {tile.enabled ? (
          <Link to={tile.to}>
            <p className="ps-label">{t('nav.devScan')}</p>
            <h3>{title}</h3>
          </Link>
        ) : (
          <div>
            <p className="ps-label">{t('nav.devScan')}</p>
            <h3>{title}</h3>
          </div>
        )}
        <div className="ps-work-foot">
          <div className="ps-work-meta">
            <div>
              <b className="ps-label">{t('work.note')}</b>
              <span>{t(`svc.${tile.id}.caption`)}</span>
            </div>
            <div>
              <b className="ps-label">{t('work.status')}</b>
              <span>{status}</span>
            </div>
          </div>
          <div className="ps-work-pager">
            <p className="ps-label">
              {t('work.image')} {index + 1}/{slides.length}
            </p>
            <div className="ps-pager-btns">
              <button
                type="button"
                className="ps-pager-btn"
                aria-label={t('work.prev')}
                disabled={index === 0}
                onClick={() => setIndex((p) => Math.max(0, p - 1))}
              >
                <PagerArrow back />
              </button>
              <button
                type="button"
                className="ps-pager-btn"
                aria-label={t('work.next')}
                disabled={index === slides.length - 1}
                onClick={() => setIndex((p) => Math.min(slides.length - 1, p + 1))}
              >
                <PagerArrow />
              </button>
            </div>
          </div>
        </div>
      </div>
      {tile.enabled ? (
        <Link to={tile.to} className={shotClass} aria-label={title}>
          <PsPhoto src={slide.src} tone={tile.tone} className="ps-work-shot-photo" alt={title} />
        </Link>
      ) : (
        <div className={shotClass} aria-hidden>
          <PsPhoto src={slide.src} tone={tile.tone} className="ps-work-shot-photo" alt="" />
        </div>
      )}
      {peek ? (
        <div className="ps-work-shot ps-work-shot--peek" aria-hidden>
          <PsPhoto src={peek.src} tone={peek.tile.tone} className="ps-work-shot-photo" alt="" />
        </div>
      ) : null}
    </article>
  );
}

function BandHead({ title, lede, actions }) {
  return (
    <>
      <h2 className="ps-lab-heading">{title}</h2>
      <div className="ps-lab-side">
        <p className="ps-lab-intro">{lede}</p>
        <div className="ps-band-ctas">{actions}</div>
      </div>
    </>
  );
}

export default function PublicHome() {
  const { t, lang } = usePublicLocale();
  const [extras, setExtras] = useState({ blog: [], accessories: [], shop: [] });
  useEffect(() => {
    Promise.all([
      loadPublicContent(),
      publicApi.get('/public/shop').then(({ data }) => data?.items || []).catch(() => []),
    ]).then(([content, shop]) => setExtras({ ...content, shop }));
  }, []);
  const accCards = extras.shop.length
    ? extras.shop.slice(0, 4).map((row, i) => ({
        id: `${row.source}-${row.id}`,
        title: row.title,
        note: row.description || row.brand,
        status: row.available ? formatShopPublicPrice(row.price) : t('acc.sold'),
        image: row.image,
        tone: ACC_CARDS[i % ACC_CARDS.length].tone,
      }))
    : extras.accessories.length
    ? extras.accessories.map((row, i) => ({
        id: row.id,
        title: row.title,
        note: row.excerpt || row.kind,
        status: row.kind || t('work.soon'),
        image: row.image,
        tone: ACC_CARDS[i % ACC_CARDS.length].tone,
      }))
    : ACC_CARDS.map((card, i) => ({
        id: card.id,
        title: t(`acc.${card.id}h`),
        note: t(`acc.${card.id}p`),
        status: t('work.soon'),
        image: LAB_PHOTO.acc[i] || '',
        tone: card.tone,
      }));
  const stories = (extras.blog.length ? remoteBlogPosts(extras.blog, t, lang) : fallbackBlogPosts(t)).slice(
    0,
    3
  );
  return (
    <>
    <PublicMobileHome extras={extras} />
    <div className="ps-desk-home">
    <PsPage>
      <section className="ps-hero ps-grid">
        <PsGridFrame tone="intro" />
        <div className="ps-arrive">
          <p className="ps-arrive-kicker">{t('home.place')}</p>
          <h1 className="ps-arrive-title">{t('home.placeTitle')}</h1>
          <p className="ps-arrive-line">{t('home.placeLine')}</p>
          <div className="ps-arrive-doors">
            <Link to="/film" className="ps-door">
              <PsPhoto src={LAB_PHOTO.film} tone="film" className="ps-door-photo" alt="" />
              <span className="ps-door-copy">
                <b>{t('home.doorFilm')}</b>
                <span>{t('home.doorFilmSub')}</span>
              </span>
              <span className="ps-door-go" aria-hidden>→</span>
            </Link>
            <Link to={PATH.repair} className="ps-door">
              <PsPhoto src={LAB_PHOTO.repair} tone="print" className="ps-door-photo" alt="" />
              <span className="ps-door-copy">
                <b>{t('home.doorRepair')}</b>
                <span>{t('home.doorRepairSub')}</span>
              </span>
              <span className="ps-door-go" aria-hidden>→</span>
            </Link>
          </div>
          <ol className="ps-arrive-steps">
            <li>{t('home.step1')}</li>
            <li>{t('home.step2')}</li>
            <li>{t('home.step3')}</li>
          </ol>
        </div>
        <h1 className="ps-hero-poster">
          {t('home.h1a')}
          <br />
          {t('home.h1b')}
        </h1>
        <p className="ps-lede">{t('home.lede')}</p>
        <div className="ps-specs">
          <span>{t('home.spec1')}</span>
          <span>{t('home.spec2')}</span>
          <span>{t('home.spec3')}</span>
        </div>
        <div className="ps-hero-actions">
          <Link to="/film" className="ps-cta ps-cta--fill">
            {t('cta.sendRoll')}
          </Link>
          <Link to={PATH.repair} className="ps-cta">
            {t('cta.repair')}
          </Link>
        </div>
        <PsPhoto src={LAB_PHOTO.homeHero} tone="film" className="ps-hero-photo" alt="" />
      </section>

      <section className="ps-lab-block ps-grid">
        <PsGridFrame tone="band" />
        <h2 className="ps-lab-heading">{t('home.services')}</h2>
        <div className="ps-lab-side">
          <p className="ps-lab-intro">{t('home.intro')}</p>
          <a href="#repair-home" className="ps-cta">
            {t('cta.allServices')}
          </a>
        </div>
        <div className="ps-works">
          <FeaturedWork tiles={FEATURED} />
        </div>
      </section>

      <section id="repair-home" className="ps-lab-block ps-band ps-grid">
        <PsGridFrame tone="band" />
        <BandHead
          title={t('home.bandRepair')}
          lede={t('home.bandRepairP')}
          actions={
            <>
              <Link to={PATH.repair} className="ps-cta">
                {t('cta.sendRepair')}
              </Link>
              <Link to={PATH.contact} className="ps-cta">
                {t('nav.contact')} →
              </Link>
            </>
          }
        />
        <PsPhoto src={LAB_PHOTO.repair} tone="print" className="ps-band-field" alt="" />
      </section>

      <section className="ps-lab-block ps-band ps-grid">
        <PsGridFrame tone="band" />
        <BandHead
          title={t('home.bandAcc')}
          lede={t('home.bandAccP')}
          actions={
            <Link to={PATH.shop} className="ps-cta">
              {t('cta.viewAcc')}
            </Link>
          }
        />
        <div className="ps-prod-row">
          {accCards.map((card) => (
            <Link key={card.id} to={PATH.shop} className="ps-prod">
              <PsPhoto src={card.image} tone={card.tone} className="ps-prod-photo" alt={card.title} />
              <h3>{card.title}</h3>
              <div className="ps-prod-meta">
                <div>
                  <b className="ps-label">{t('work.note')}</b>
                  <span>{card.note}</span>
                </div>
                <div>
                  <b className="ps-label">{t('work.status')}</b>
                  <span>{card.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="ps-lab-block ps-band ps-grid">
        <PsGridFrame tone="band" />
        <BandHead
          title={t('home.bandBlog')}
          lede={t('home.bandBlogP')}
          actions={
            <Link to="/blog" className="ps-cta">
              {t('cta.viewBlog')}
            </Link>
          }
        />
        <div className="ps-stories">
          {stories.map((post) => (
            <Link key={post.id} to={post.href} className="ps-story">
              <PsPhoto src={post.image} tone={post.tone} className="ps-story-photo" alt={post.title} />
              <div className="ps-story-title">
                <h3>{post.title}</h3>
                <div className="ps-story-tags">
                  <span className="ps-label">{post.kind}</span>
                  <span className="ps-label">{post.date}</span>
                </div>
              </div>
              <p>{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
    </PsPage>
    </div>
    </>
  );
}

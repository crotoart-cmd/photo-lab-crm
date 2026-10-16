import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATH } from '../../config/publicPaths';
import { LAB_PHOTO } from '../../data/publicLabPhotos';
import { fallbackBlogPosts, remoteBlogPosts } from '../../lib/publicBlog';
import { formatShopPublicPrice } from '../../lib/shopFx';
import PsPhoto from './PsPhoto';
import { PsLangSwitch, usePublicLocale } from './PublicLocale';
import PublicMobileAlbumAccess from './PublicMobileAlbumAccess';
import PublicMobileIcon from './PublicMobileIcon';
import PublicMobileBrand from './PublicMobileBrand';
import PublicShopOrderSheet from './PublicShopOrderSheet';

export default function PublicMobileHome({ extras }) {
  const { t, lang } = usePublicLocale();
  const posts = (extras?.blog?.length ? remoteBlogPosts(extras.blog, t, lang) : fallbackBlogPosts(t)).slice(0, 3);
  const products = (Array.isArray(extras?.shop) ? extras.shop : []).slice(0, 4);
  const [buying, setBuying] = useState(null);
  const closeShop = useCallback(() => setBuying(null), []);

  useEffect(() => {
    if (!buying) return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const onResize = () => { if (!media.matches) closeShop(); };
    const previous = document.activeElement;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    if (root) root.inert = true;
    const dialog = document.querySelector('.ps-sheet--product');
    dialog?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href]')].filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    media.addEventListener('change', onResize);
    document.addEventListener('keydown', onKey);
    return () => {
      media.removeEventListener('change', onResize);
      document.removeEventListener('keydown', onKey);
      if (root) root.inert = previousInert;
      previous?.focus({ preventScroll: true });
    };
  }, [buying, closeShop]);
  const services = [
    { to: PATH.scan, title: t('nav.scan'), detail: t('mhome.card.scanSub'), image: LAB_PHOTO.scan },
    { to: PATH.print, title: t('nav.print'), detail: t('mhome.cat.print'), image: LAB_PHOTO.print },
  ];

  return (
    <div className="ps-mhome pm-home">
      <header className="ps-mpro-nav pm-home-nav">
        <PublicMobileBrand />
        <PsLangSwitch />
      </header>

      <section className="pm-home-hero">
        <PsPhoto src={LAB_PHOTO.bench} className="pm-home-hero-photo" alt="" />
        <div className="pm-home-hero-copy">
          <p className="pm-eyebrow">ANALOG PHOTO LAB / 01</p>
          <h1>{t('exp.heroTitle')}</h1>
          <p className="pm-home-process">C-41 · B&W · ECN-2 · E-6</p>
          <div className="pm-home-hero-ctas">
            <Link to={PATH.film} className="pm-primary">{t('mpage.startFilm')}<PublicMobileIcon name="arrow_forward" /></Link>
            <Link to={PATH.repair} className="pm-home-repair-cta"><PublicMobileIcon name="build" /><span>{t('rp.cta')}</span><PublicMobileIcon name="arrow_forward" /></Link>
          </div>
        </div>
      </section>

      <div className="pm-home-actions">
        <Link to={PATH.repair} className="pm-home-action"><PublicMobileIcon name="build" /><span>{t('nav.repair')}</span><PublicMobileIcon name="arrow_outward" /></Link>
        <PublicMobileAlbumAccess />
      </div>

      <section className="pm-home-repair" aria-labelledby="home-repair-title">
        <div className="pm-section-heading"><p className="pm-eyebrow">CAMERA REPAIR</p><span>HDT / SERVICE</span></div>
        <h2 id="home-repair-title">{t('rp.homeTitle')}</h2>
        <Link to={PATH.repair} className="pm-home-repair-photo" aria-label={t('rp.homeLink')}><img src={LAB_PHOTO.repair} alt="Contax" loading="lazy" /><PublicMobileIcon name="arrow_outward" /></Link>
        <p>{t('rp.homeBody')}</p>
        <Link to={PATH.repair} className="pm-home-repair-link"><span>{t('rp.noEstimate')}</span><b>{t('rp.homeLink')}<PublicMobileIcon name="arrow_forward" /></b></Link>
      </section>

      <Link to={PATH.speed} className="pm-lab-window">
        <span><small>{t('mhome.metric.speed')}</small><b>{t('time.2w')}</b></span>
        <span><small>{t('mhome.metric.batch')}</small><b>{t('mhome.metric.batchV')}</b></span>
        <PublicMobileIcon name="arrow_outward" />
      </Link>

      <section className="pm-home-blog" id="pm-home-blog" aria-labelledby="pm-blog-title">
        <div className="pm-section-heading"><h2 id="pm-blog-title">{t('nav.blog')}</h2><Link to={PATH.blog} className="pm-section-more">{t('mpage.viewAll')}<PublicMobileIcon name="arrow_forward" /></Link></div>
        {posts.map((post, index) => <Link key={post.id || post.slug} to={post.href} className={index === 0 ? 'pm-blog-feature' : 'pm-blog-row'}>
          <PsPhoto src={post.image} className="pm-blog-photo" alt="" />
          <div className="pm-blog-copy"><p className="pm-blog-meta"><span>{post.kind}</span>{post.date ? <span>{post.date}</span> : null}</p><h3>{post.title}</h3></div>
          <PublicMobileIcon name="arrow_outward" />
        </Link>)}
      </section>

      <section className="pm-home-shop" id="pm-home-shop" aria-labelledby="pm-shop-title">
        <div className="pm-section-heading"><h2 id="pm-shop-title">{t('mtab.shop')}</h2><Link to={PATH.shop} className="pm-section-more">{t('mpage.viewAll')}<PublicMobileIcon name="arrow_forward" /></Link></div>
        {products.length ? <div className="pm-home-products">{products.map((product) => <button key={`${product.source}-${product.id}`} type="button" className="pm-home-product" onClick={() => setBuying({ ...product, orderable: true })}>
          <PsPhoto src={product.image} className="pm-product-photo" alt="" />
          <span className="pm-product-copy">{product.brand ? <small>{product.brand}</small> : null}<b>{product.title}</b><span className={product.available ? '' : 'pm-product-sold'}>{product.available ? formatShopPublicPrice(product.price) : t('acc.sold')}</span></span>
        </button>)}</div> : <p className="pm-home-shop-empty">{t('mpage.emptyShop')}</p>}
      </section>

      <section className="pm-services" aria-labelledby="pm-services-title">
        <div className="pm-section-heading"><h2 id="pm-services-title">{t('home.services')}</h2><span>HDT / LAB</span></div>
        {services.map((service, index) => <Link to={service.to} className="pm-service-row" key={service.to}>
          <span className="pm-service-no">0{index + 1}</span>
          <span><b>{service.title}</b><small>{service.detail}</small></span>
          <PsPhoto src={service.image} className="pm-service-photo" />
          <PublicMobileIcon name="arrow_outward" />
        </Link>)}
      </section>

      <Link to={PATH.contact} className="pm-home-contact"><span>{t('mhome.map')}<b>{t('nav.contact')}</b></span><PublicMobileIcon name="arrow_outward" /></Link>
      {buying ? <PublicShopOrderSheet item={buying} priceLabel={formatShopPublicPrice(buying.price)} onClose={closeShop} /> : null}
    </div>
  );
}

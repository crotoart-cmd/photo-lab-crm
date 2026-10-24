import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Share2, ZoomIn } from 'lucide-react';
import { usePublicLocale } from '../components/public/PublicLocale';
import { JournalCard, JournalMeta, JournalMobileNav, JournalStatus } from '../components/public/JournalParts';
import useJournalPosts from '../hooks/useJournalPosts';
import { fallbackBlogPosts, findBlogPost } from '../lib/publicBlog';
import { journalCopy, journalPost, relatedJournalPosts } from '../lib/publicJournal';
import '../styles/public-journal.css';

const PhotoViewer = lazy(() => import('../components/public/JournalPhotoViewer'));
export default function PublicBlogPost() {
  const { slug } = useParams();
  const { lang, t } = usePublicLocale();
  const location = useLocation();
  const copy = journalCopy(lang);
  const { posts, status, reload } = useJournalPosts();
  const post = useMemo(() => findBlogPost(posts, slug) || (status === 'ready' ? findBlogPost(fallbackBlogPosts(t).map((item) => journalPost({ ...item, language: lang })), slug) : null), [posts, slug, status, t, lang]);
  const related = useMemo(() => post ? relatedJournalPosts(posts, post) : [], [posts, post]);
  const contentRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [share, setShare] = useState('');
  const closeViewer = useCallback(() => setViewerIndex(-1), []);
  const backParams = new URLSearchParams(location.state?.journalSearch || ''); backParams.set('lang', lang);
  const back = `/blog?${backParams}`;
  const headings = post?.blocks.map((block, index) => block.type === 'heading' ? { text: block.text, id: `story-section-${index}` } : null).filter(Boolean) || [];
  const slides = useMemo(() => post ? [{ src: post.image, alt: post.title, description: post.imageCaption }, ...post.blocks.flatMap((block) => block.type === 'image' ? [block] : block.type === 'gallery' ? block.images : [])].map((item) => ({ ...item, description: item.description || item.caption })) : [], [post]);
  useEffect(() => { setShare(''); setViewerIndex(-1); setProgress(0); window.scrollTo({ top: 0, behavior: 'instant' }); }, [slug]);
  useEffect(() => { if (post) document.title = `${post.title} | HDTLabx Journal`; }, [post]);
  useEffect(() => {
    let frame;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const box = contentRef.current?.getBoundingClientRect();
      if (box) setProgress(Math.max(0, Math.min(100, ((window.innerHeight - box.top) / Math.max(1, box.height)) * 100)));
    }); };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [post]);
  const shareStory = async () => {
    try { if (navigator.share) { await navigator.share({ title: post.title, url: window.location.href }); setShare(''); }
      else { await navigator.clipboard.writeText(window.location.href); setShare('copied'); }
    } catch (error) { if (error.name !== 'AbortError') setShare('manual'); }
  };
  const figure = (item, key) => {
    const index = slides.findIndex((slide) => slide.src === item.src && slide.description === item.caption);
    return <figure key={key} className="journal-figure"><button type="button" className="journal-image-button" aria-label={`${copy.openImage}: ${item.alt || post.title}`} onClick={() => setViewerIndex(Math.max(0, index))}><img src={item.src} alt={item.alt || item.caption || ''} loading="lazy" decoding="async" /><span className="journal-image-zoom" aria-hidden="true"><ZoomIn size={18} /></span></button>{(item.caption || item.credit) && <figcaption>{item.caption}{item.credit && <small>{item.credit}</small>}</figcaption>}</figure>;
  };
  return <div className="public-journal journal-article"><JournalMobileNav back={back} label={copy.back} />
    <div className="journal-progress" role="progressbar" aria-label={copy.reading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
    <div className="journal-width"><Link to={back} className="journal-back"><ArrowLeft size={17} />{copy.back}</Link>
      {status !== 'ready' ? <JournalStatus status={status} reload={reload} copy={copy} /> : !post ? <div className="journal-empty"><h1>{copy.missing}</h1><p>{copy.missingText}</p><Link to={back}>{copy.back}<ArrowUpRight size={18} /></Link></div> : <>
        <header className="journal-article-head"><div className="journal-article-labels"><JournalMeta post={post} copy={copy} date={false} />{post.draft && <span className="journal-draft">{copy.draft}</span>}</div><h1>{post.title}</h1><p className="journal-article-lede">{post.excerpt}</p>
          <div className="journal-byline"><div><span>{copy.author}</span><b>{post.author}</b></div><div><span>{post.draft ? copy.draftDate : copy.published}</span><time>{post.dateLong || post.date}</time></div><button type="button" className="journal-share" onClick={shareStory} aria-label={copy.share} title={copy.share}>{share === 'copied' ? <Check size={18} /> : <Share2 size={18} />}<span>{share === 'copied' ? copy.copied : copy.share}</span></button></div>
          {share === 'manual' && <label className="journal-share-fallback">{copy.copyError}<input aria-label={copy.copyError} readOnly value={window.location.href} onFocus={(event) => event.target.select()} /></label>}<span className="journal-sr" role="status">{share === 'copied' ? copy.copied : ''}</span>{post.language && lang !== post.language && <p className="journal-language-note">{copy.original}: {{ en: 'English', vi: 'Tiếng Việt', de: 'Deutsch', es: 'Español' }[post.language]}</p>}
        </header>
        <figure className="journal-cover"><button type="button" className="journal-image-button" onClick={() => setViewerIndex(0)} aria-label={`${copy.openImage}: ${post.title}`}><img src={post.image} alt={post.title} fetchpriority="high" style={{ objectPosition: post.imagePosition }} /><span className="journal-image-zoom" aria-hidden="true"><ZoomIn size={20} /></span></button>{post.imageCaption && <figcaption>{post.imageCaption}</figcaption>}</figure>
        <div className={`journal-reading-grid${headings.length < 2 ? ' journal-reading-grid--plain' : ''}`}>{headings.length >= 2 && <aside className="journal-toc"><p className="journal-kicker">{copy.contents}</p><ol>{headings.map((heading) => <li key={heading.id}><Link to={{ pathname: location.pathname, search: location.search, hash: `#${heading.id}` }} state={location.state} preventScrollReset onClick={() => document.getElementById(heading.id)?.scrollIntoView({ behavior: 'auto', block: 'start' })}>{heading.text}</Link></li>)}</ol></aside>}
          <article ref={contentRef} className="journal-prose" lang={post.language}>{post.blocks.map((block, index) => {
            if (block.type === 'heading') return <h2 id={`story-section-${index}`} key={index}>{block.text}</h2>;
            if (block.type === 'image') return figure(block, index);
            if (block.type === 'gallery') return <div className="journal-inline-gallery" key={index}>{block.images.map((item, imageIndex) => figure(item, imageIndex))}</div>;
            if (block.type === 'note') return <blockquote key={index}>{block.text}</blockquote>;
            return <p key={index}>{block.text}</p>;
          })}{post.tags.length > 0 && <div className="journal-tags">{post.tags.map((tag) => <Link key={tag} to={`/blog?lang=${lang}&q=${encodeURIComponent(tag)}`}>{tag}<ArrowUpRight size={13} /></Link>)}</div>}</article>
        </div>
        <section className="journal-service"><p className="journal-kicker">HDTLabx / {post.category === 'repair' ? 'Repair' : 'Film lab'}</p><h2>{post.category === 'repair' ? copy.repairTitle : copy.filmTitle}</h2><p>{post.category === 'repair' ? copy.repairText : copy.filmText}</p><Link className="journal-text-link" to={`${post.category === 'repair' ? '/repair' : '/film'}?lang=${lang}`}>{post.category === 'repair' ? copy.repairCta : copy.filmCta}<ArrowUpRight size={21} /></Link></section>
        {related.length > 0 && <section className="journal-related"><header className="journal-section-head"><h2>{copy.related}</h2><Link to={back}>{copy.all}<ArrowUpRight size={17} /></Link></header><div className="journal-grid">{related.map((item) => <JournalCard post={item} copy={copy} lang={lang} key={item.id} />)}</div></section>}
      </>}
    </div>{viewerIndex >= 0 && <Suspense fallback={null}><PhotoViewer open index={viewerIndex} slides={slides} onClose={closeViewer} copy={copy} /></Suspense>}
  </div>;
}

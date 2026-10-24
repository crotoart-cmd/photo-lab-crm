import { useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search, X } from 'lucide-react';
import { usePublicLocale } from '../components/public/PublicLocale';
import { JournalCard, JournalMeta, JournalMobileNav, JournalPager, JournalStatus } from '../components/public/JournalParts';
import useJournalPosts from '../hooks/useJournalPosts';
import { JOURNAL_CATEGORIES, journalCopy, journalHref, journalPage, selectJournalPosts } from '../lib/publicJournal';
import '../styles/public-journal.css';

export default function PublicBlog() {
  const { lang } = usePublicLocale();
  const copy = journalCopy(lang);
  const { posts, status, reload } = useJournalPosts();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const listRef = useRef(null);
  const category = JOURNAL_CATEGORIES.includes(params.get('category')) ? params.get('category') : 'all';
  const query = params.get('q') || '';
  const browsing = category === 'all' && !query.trim();
  const selected = selectJournalPosts(posts, { category, query });
  const featured = posts.find((post) => post.featured) || posts[0];
  const page = journalPage(browsing ? selected.filter((post) => post.id !== featured?.id) : selected, params.get('page'));
  const repair = posts.filter((post) => post.category === 'repair').slice(0, 2);
  const story = posts.find((post) => post.category === 'stories' && post.id !== featured?.id) || posts.find((post) => post.category === 'stories');
  const change = (values, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== 'all' && !(key === 'page' && value === 1)) next.set(key, String(value)); else next.delete(key);
    }
    setParams(next, { replace, preventScrollReset: true });
  };
  const jumpPage = (value) => { change({ page: value }); listRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); };
  useEffect(() => {
    if (status === 'ready' && Number(params.get('page')) > 1) listRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [status]);
  return <div className="public-journal"><JournalMobileNav /><div className="journal-width">
    <header className="journal-heading"><div><p className="journal-kicker">HDTLabx / Field notes</p><h1>{copy.title}<span>.</span></h1></div><p>{copy.intro}</p></header>
    <div className="journal-toolbar"><div className="journal-categories" role="group" aria-label={copy.title}>
      {['all', ...JOURNAL_CATEGORIES].map((value) => <button type="button" key={value} className={category === value ? 'is-current' : ''} aria-pressed={category === value} onClick={() => change({ category: value, page: 1 })}>{copy[value]}<span>{value === 'all' ? posts.length : posts.filter((post) => post.category === value).length}</span></button>)}
    </div><div className="journal-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => change({ q: event.target.value.slice(0, 120), page: 1 }, true)} />
      {query && <button type="button" title={copy.clear} aria-label={copy.clear} onClick={() => change({ q: '', page: 1 }, true)}><X size={16} /></button>}</div></div>
    {status !== 'ready' ? <JournalStatus status={status} reload={reload} copy={copy} /> : <>
      {browsing && featured && <section className="journal-feature" aria-label={copy.featured}><Link to={journalHref(featured, lang)} state={{ journalSearch: location.search }} className="journal-feature-link">
        <div className="journal-feature-image"><img src={featured.image} alt={featured.title} fetchpriority="high" style={{ objectPosition: featured.imagePosition }} /><span className="journal-feature-label">{copy.featured}</span><span className="journal-feature-open" aria-hidden="true"><ArrowUpRight size={24} /></span></div>
        <div className="journal-feature-caption"><div><JournalMeta post={featured} copy={copy} /><h2>{featured.title}</h2></div><p>{featured.excerpt}</p></div></Link></section>}
      <section className="journal-latest" ref={listRef} aria-labelledby="journal-list-title"><header className="journal-section-head"><h2 id="journal-list-title">{browsing ? copy.latest : copy[category] || copy.latest}</h2><span aria-live="polite">{browsing ? selected.length - (featured ? 1 : 0) : selected.length} {selected.length === 1 ? copy.result : copy.results}</span></header>
        {page.items.length ? <div className="journal-grid">{page.items.map((post) => <JournalCard key={post.id} post={post} copy={copy} lang={lang} />)}</div> : <div className="journal-empty"><h3>{posts.length ? copy.noResults : copy.empty}</h3><p>{posts.length ? copy.noResultsText : copy.emptyText}</p>{posts.length > 0 && <button type="button" onClick={() => change({ category: 'all', q: '', page: 1 })}>{copy.reset}<ArrowRight size={18} /></button>}</div>}
        <JournalPager {...page} onPage={jumpPage} copy={copy} /></section>
      {browsing && repair.length > 0 && <section className="journal-bench" aria-labelledby="journal-bench-title"><div className="journal-bench-intro"><p className="journal-kicker">HDTLabx / Repair journal</p><h2 id="journal-bench-title">{copy.bench}<span>.</span></h2><p>{copy.benchIntro}</p><button type="button" className="journal-text-link" onClick={() => { change({ category: 'repair', page: 1 }); listRef.current?.scrollIntoView({ behavior: 'instant' }); }}>{copy.benchLink}<ArrowUpRight size={20} /></button></div><div className="journal-bench-posts">{repair.map((post) => <JournalCard key={post.id} post={post} copy={copy} lang={lang} compact />)}</div></section>}
      {browsing && story && <section className="journal-roll" aria-labelledby="journal-roll-title"><header className="journal-section-head"><div><p className="journal-kicker">Photo stories</p><h2 id="journal-roll-title">{copy.roll}</h2></div><p>{copy.rollIntro}</p></header><Link to={journalHref(story, lang)} state={{ journalSearch: location.search }} className="journal-roll-link"><img src={story.image} alt={story.title} loading="lazy" /><div><JournalMeta post={story} copy={copy} /><h3>{story.title}</h3><span className="journal-text-link">{copy.read}<ArrowUpRight size={21} /></span></div></Link></section>}
    </>}
  </div></div>;
}

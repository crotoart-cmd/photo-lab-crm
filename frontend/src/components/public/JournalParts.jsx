import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { PsLangSwitch } from './PublicLocale';
import PublicMobileBrand from './PublicMobileBrand';
import { journalHref } from '../../lib/publicJournal';

export function JournalMobileNav({ back, label }) {
  return <nav className="journal-mobile-nav" aria-label="Journal">
    {back && <Link to={back} className="journal-icon" title={label} aria-label={label}><ArrowLeft size={20} /></Link>}
    <PublicMobileBrand /><span className="journal-nav-space" /><PsLangSwitch />
  </nav>;
}
export function JournalMeta({ post, copy, date = true }) {
  return <div className="journal-meta"><span>{copy[post.category]}</span><span>{post.minutes} {copy.minutes}</span>{date && <time>{post.date}</time>}</div>;
}
export function JournalCard({ post, copy, lang, compact = false }) {
  const location = useLocation();
  return <article className={`journal-card${compact ? ' journal-card--compact' : ''}`}>
    <Link to={journalHref(post, lang)} state={{ journalSearch: location.state?.journalSearch || location.search }} className="journal-card-link">
      <div className="journal-card-image"><img src={post.image} alt={post.title} loading="lazy" decoding="async" style={{ objectPosition: post.imagePosition }} /></div>
      <div className="journal-card-copy"><JournalMeta post={post} copy={copy} date={!compact} /><h3>{post.title}</h3>{!compact && <p>{post.excerpt}</p>}
        <span className="journal-card-arrow" aria-hidden="true"><ArrowUpRight size={21} /></span></div>
    </Link>
  </article>;
}
export function JournalPager({ page, pages, onPage, copy }) {
  if (pages < 2) return null;
  const visible = [...new Set([1, page - 1, page, page + 1, pages])].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  return <nav className="journal-pagination" aria-label={copy.page}><span>{copy.page} {page} {copy.of} {pages}</span><div>
    <button type="button" className="journal-icon" title={copy.previous} aria-label={copy.previous} disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={20} /></button>
    {visible.map((value, index) => <span className="journal-page-slot" key={value}>{index > 0 && value > visible[index - 1] + 1 && <span aria-hidden="true">...</span>}<button type="button" aria-label={`${copy.page} ${value}`} aria-current={value === page ? 'page' : undefined} onClick={() => onPage(value)}>{value}</button></span>)}
    <button type="button" className="journal-icon" title={copy.next} aria-label={copy.next} disabled={page === pages} onClick={() => onPage(page + 1)}><ChevronRight size={20} /></button></div></nav>;
}
export function JournalStatus({ status, reload, copy }) {
  return <div className="journal-status" role="status"><p>{status === 'loading' ? copy.loading : copy.error}</p>{status === 'error' && <button type="button" onClick={reload}><RotateCw size={17} />{copy.retry}</button>}</div>;
}

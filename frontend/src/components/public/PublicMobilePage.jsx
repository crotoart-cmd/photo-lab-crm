import { Link } from 'react-router-dom';
import PsPhoto from './PsPhoto';
import { PsLangSwitch, usePublicLocale } from './PublicLocale';
import PublicMobileBrand from './PublicMobileBrand';

export function PublicMobilePage({ back, children }) {
  const { t } = usePublicLocale();
  return (
    <div className="ps-mpage">
      <header className="ps-mpro-nav">
        {back != null ? (
          <Link to={back} className="ps-mback" aria-label={t('mhome.back')}>
            ‹
          </Link>
        ) : (
          <PublicMobileBrand />
        )}
        <span className="ps-mnav-spacer" />
        <PsLangSwitch />
      </header>
      {children}
    </div>
  );
}

export function PublicMobileTitle({ title, spec }) {
  return (
    <div className="ps-mhead">
      <h1>{title}</h1>
      {spec ? <p>{spec}</p> : null}
    </div>
  );
}

export function PublicMobileBanner({ src, tone = 'film' }) {
  return <PsPhoto src={src} tone={tone} className="ps-mphoto" alt="" />;
}

export function PublicMobileGroup({ children }) {
  return <div className="ps-mpro-group">{children}</div>;
}

export function PublicMobileSection({ title, children }) {
  return (
    <div className="ps-mblock">
      {title ? <p className="ps-msection-h">{title}</p> : null}
      {children}
    </div>
  );
}

export function PublicMobileStat({ title, hint }) {
  return (
    <div className="ps-mstat">
      <span>
        <b>{title}</b>
        {hint ? <i>{hint}</i> : null}
      </span>
    </div>
  );
}

export function PublicMobileRowLink({ to, title, hint }) {
  return (
    <Link to={to} className="ps-mpro-row">
      <span>
        <b>{title}</b>
        {hint ? <i>{hint}</i> : null}
      </span>
      <em aria-hidden>›</em>
    </Link>
  );
}

export function PublicMobileChips({ value, onChange, options, labelledBy }) {
  return (
    <div className={`ps-mchips${options.some((option) => option.hint) ? ' pm-choices' : ''}`} role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'is-on' : undefined}
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={value === opt.value || (!options.some((option) => option.value === value) && opt === options[0]) ? 0 : -1}
          onKeyDown={(event) => {
            const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!delta && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const current = options.indexOf(opt);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + delta + options.length) % options.length;
            onChange(options[next].value);
            event.currentTarget.parentElement.children[next].focus();
          }}
          onClick={() => onChange(opt.value)}
        >
          {opt.hint ? <><span>{opt.label}</span><small>{opt.hint}</small></> : opt.label}
        </button>
      ))}
    </div>
  );
}

export function PublicMobileCta({ to, children, fill }) {
  return (
    <Link to={to} className={`ps-mcta${fill ? ' ps-mcta--fill' : ''}`}>
      {children}
    </Link>
  );
}

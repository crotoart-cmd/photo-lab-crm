import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  PUBLIC_LANGS,
  publicT,
  readPublicLang,
  writePublicLang,
} from '../../lib/publicI18n';

const PublicLocaleContext = createContext(null);

export function usePublicLocale() {
  const ctx = useContext(PublicLocaleContext);
  if (!ctx) throw new Error('usePublicLocale');
  return ctx;
}

export function PublicLocaleProvider({ children }) {
  const [lang, setLangState] = useState(readPublicLang);

  const setLang = (id) => {
    if (!PUBLIC_LANGS.some((l) => l.id === id)) return;
    setLangState(id);
    writePublicLang(id);
  };

  useEffect(() => {
    const meta = PUBLIC_LANGS.find((l) => l.id === lang);
    document.documentElement.lang = meta?.html || 'en';
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      langs: PUBLIC_LANGS,
      t: (key) => publicT(lang, key),
    }),
    [lang],
  );

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export function PsLangSwitch() {
  const { lang, setLang, langs, t } = usePublicLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = langs.find((l) => l.id === lang) || langs[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ps-lang" ref={wrapRef}>
      <button
        type="button"
        className="ps-cta ps-lang-btn"
        aria-label={t('lang.label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {current.code}
      </button>
      {open ? (
        <ul className="ps-lang-menu" role="listbox" aria-label={t('lang.label')}>
          {langs.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === lang}
                className={item.id === lang ? 'is-on' : ''}
                onClick={() => {
                  setLang(item.id);
                  setOpen(false);
                }}
              >
                <b>{item.code}</b>
                <span>{item.native}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

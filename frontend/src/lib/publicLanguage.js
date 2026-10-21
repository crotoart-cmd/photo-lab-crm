export const PUBLIC_LANGS = [
  { id: 'en', code: 'EN', html: 'en', native: 'English' },
  { id: 'vi', code: 'VI', html: 'vi', native: 'Tiếng Việt' },
  { id: 'de', code: 'DE', html: 'de', native: 'Deutsch' },
  { id: 'es', code: 'ES', html: 'es', native: 'Español' },
];

export const PUBLIC_LANG_KEY = 'hdtlabx.publicLang';

export function supportedPublicLang(value) {
  return PUBLIC_LANGS.some(({ id }) => id === value) ? value : null;
}

export function resolvePublicLanguage({ query, saved, languages = [] } = {}) {
  if (supportedPublicLang(query)) return query;
  if (supportedPublicLang(saved)) return saved;
  for (const locale of languages) {
    const id = String(locale).toLowerCase().split(/[-_]/)[0];
    if (supportedPublicLang(id)) return id;
  }
  return 'en';
}

export function readPublicLang(query) {
  let saved;
  try {
    saved = localStorage.getItem(PUBLIC_LANG_KEY);
  } catch {
    /* Storage may be disabled in private browsing. */
  }
  const browser = typeof navigator === 'undefined' ? {} : navigator;
  return resolvePublicLanguage({ query, saved, languages: browser.languages?.length ? browser.languages : [browser.language || 'en'] });
}

export function writePublicLang(id) {
  if (!supportedPublicLang(id)) return;
  try {
    localStorage.setItem(PUBLIC_LANG_KEY, id);
  } catch {
    /* Language switching must still work without storage. */
  }
}

export function localizedPublicSearch(search, lang) {
  const params = new URLSearchParams(search);
  params.set('lang', supportedPublicLang(lang) || 'en');
  return `?${params.toString()}`;
}

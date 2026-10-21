import copy from '../../../backend/lib/publicSeoData.json';

const ORIGIN = 'https://hdtlabx.com';
const ALIASES = { '/sua-may': '/repair', '/phu-kien': '/shop', '/lien-he': '/contact' };

export function publicMetadata(pathname, language) {
  const lang = Object.prototype.hasOwnProperty.call(copy, language) ? language : 'en';
  const clean = pathname.replace(/\/+$/, '') || '/';
  const path = ALIASES[clean] || clean;
  const key = Object.prototype.hasOwnProperty.call(copy.en, path) ? path : /^\/blog\/[^/]+$/.test(path) ? '/blog' : null;
  if (!key) return null;
  const [title, description] = copy[lang][key];
  const urlFor = (id) => `${ORIGIN}${path}${id === 'en' ? '' : `?lang=${id}`}`;
  return { lang, path, title, description, canonical: urlFor(lang), alternates: Object.keys(copy).map((id) => ({ lang: id, href: urlFor(id) })) };
}

export function updatePublicMetadata(pathname, language) {
  const meta = publicMetadata(pathname, language);
  if (!meta) return;
  document.title = meta.title;
  const setTag = (tag, selector, attributes) => {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement(tag);
      element.setAttribute('data-public-seo', '');
      document.head.appendChild(element);
    }
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  };
  setTag('meta', 'meta[name="description"]', { name: 'description', content: meta.description });
  setTag('link', 'link[rel="canonical"]', { rel: 'canonical', href: meta.canonical });
  for (const { lang, href } of [...meta.alternates, { lang: 'x-default', href: `${ORIGIN}${meta.path}` }]) {
    setTag('link', `link[hreflang="${lang}"]`, { rel: 'alternate', hreflang: lang, href });
  }
  for (const [property, content] of Object.entries({ 'og:site_name': 'HDTLabx', 'og:type': 'website', 'og:title': meta.title, 'og:description': meta.description, 'og:url': meta.canonical })) {
    setTag('meta', `meta[property="${property}"]`, { property, content });
  }
  const graph = document.head.querySelector('script[data-public-seo][type="application/ld+json"]');
  if (graph) {
    const data = JSON.parse(graph.textContent);
    const page = data['@graph']?.find((item) => item['@type'] === 'WebPage');
    if (page) {
      Object.assign(page, { '@id': `${meta.canonical}#webpage`, url: meta.canonical, name: meta.title, description: meta.description, inLanguage: meta.lang });
      graph.textContent = JSON.stringify(data);
    }
  }
}

import { PATH } from './publicPaths';

export const MOBILE_FILM_SERVICES = [
  { to: PATH.scan, key: 'nav.scan', hint: 'mhome.card.scanSub', icon: 'photo_library' },
  { to: PATH.print, key: 'nav.print', hint: 'svc.in-analog.caption', icon: 'description' },
  { to: PATH.speed, key: 'nav.speed', hint: 'mhome.quietSpec', icon: 'hourglass_top' },
];

export const MOBILE_TABS = [
  { to: '/', key: 'mpage.home', id: 'today', icon: 'home' },
  { to: PATH.film, key: 'nav.film', labelKey: 'mtab.film', id: 'film', icon: 'movie' },
  { to: PATH.repair, key: 'nav.repair', labelKey: 'mtab.repair', id: 'repair', icon: 'build' },
  { to: PATH.shop, key: 'mtab.shop', id: 'shop', icon: 'storefront' },
];

export const MOBILE_MORE = [
  { to: PATH.blog, key: 'nav.blog', hint: 'mhome.notes' },
  { to: PATH.about, key: 'nav.about' },
  { to: PATH.contact, key: 'nav.contact', hint: 'mhome.map' },
  { to: PATH.faq, key: 'nav.faq' },
];

const isWithin = (pathname, path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));

export function mobileTabForPath(pathname) {
  if (MOBILE_FILM_SERVICES.some((service) => isWithin(pathname, service.to))) return 'film';
  return MOBILE_TABS.find((tab) => isWithin(pathname, tab.to))?.id || 'more';
}

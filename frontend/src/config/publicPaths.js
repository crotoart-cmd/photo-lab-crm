export const PATH = {
  film: '/film',
  speed: '/toc-do',
  print: '/in-analog',
  scan: '/scan',
  repair: '/repair',
  shop: '/shop',
  contact: '/contact',
  blog: '/blog',
  about: '/about',
  faq: '/faq',
};

export const PATH_REDIRECTS = [
  { from: '/sua-may', to: PATH.repair },
  { from: '/phu-kien', to: PATH.shop },
  { from: '/lien-he', to: PATH.contact },
];

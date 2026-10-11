/** Ảnh tạm lấy từ karmir.film (và 1 máy từ shop) — fill banner / ô trống. */
const file = (name) => `${import.meta.env.BASE_URL}media/lab/${name}`;

export const LAB_PHOTO = {
  homeHero: file('home-hero.jpg'),
  develop: [file('develop-rolls.jpg'), file('develop-ticket.jpg')],
  work: {
    trang: [file('develop-rolls.jpg'), file('develop-ticket.jpg')],
    'toc-do': [file('lab-bench.jpg'), file('blog-mountain.jpg')],
    scan: [file('scan-negatives.jpg'), file('blog-colonnade.jpg')],
    'in-analog': [file('print-canon.jpg'), file('home-hero.jpg')],
  },
  peek: file('blog-colonnade.jpg'),
  repair: file('repair-camera.jpg'),
  bench: file('lab-bench.jpg'),
  film: file('develop-rolls.jpg'),
  scan: file('scan-negatives.jpg'),
  print: file('print-canon.jpg'),
  speed: file('develop-ticket.jpg'),
  blog: [file('blog-mountain.jpg'), file('blog-colonnade.jpg'), file('blog-church.jpg')],
  acc: [file('develop-rolls.jpg'), file('lab-bench.jpg'), file('print-canon.jpg'), file('scan-negatives.jpg')],
};

/** Mẫu Shop Products — giá kho VNĐ. Public đổi USD (25_000). Máy: ngày thuê × 200_000. */
const USD = 25_000;
const DAY = 200_000;
const img = (name) => `/media/shop/${name}`;

const CAMERAS = [
  { code: 'WEB-CONTAX-G2', serial: 'WEBSEED-G2', brand: 'Contax', model: 'Contax G2', type: 'Rangefinder', day: 125, file: 'contax-g2.jpg', note: 'Autofocus rangefinder. Compact travel and street body.' },
  { code: 'WEB-CONTAX-645', serial: 'WEBSEED-645', brand: 'Contax', model: 'Contax 645', type: 'SLR', day: 300, file: 'contax-645.jpg', note: 'Medium-format body with electronic lens and back coupling.' },
  { code: 'WEB-CONTAX-T3', serial: 'WEBSEED-T3', brand: 'Contax', model: 'Contax T3 Black', type: 'PnS', day: 80, file: 'contax-t3.jpg', note: 'Automatic point-and-shoot with programmed focus and flash.' },
  { code: 'WEB-HASS-503CW', serial: 'WEBSEED-503CW', brand: 'Hasselblad', model: 'Hasselblad 503CW', type: 'SLR', day: 200, file: 'hasselblad-503cw.jpg', note: 'Medium-format kit with TTL flash metering.' },
  { code: 'WEB-ELMO-S8', serial: 'WEBSEED-S8', brand: 'Elmo', model: 'Elmo Super 8 1012s-xl Macro', type: 'Other', day: 75, file: 'elmo-super8.jpg', note: 'Super 8 motion body for analog cinematography.' },
  { code: 'WEB-G2-21', serial: 'WEBSEED-G221', brand: 'Contax', model: 'G2 Green Label 21mm with viewfinder', type: 'Other', day: 50, file: 'g2-21mm.jpg', note: 'Zeiss Biogon 21mm f/2.8 for the Contax G system.' },
  { code: 'WEB-G2-35', serial: 'WEBSEED-G235', brand: 'Contax', model: 'G2 Green Label 35mm F2', type: 'Other', day: 35, file: 'g2-35mm.jpg', note: 'Planar 35mm f/2 for G2 / modified G1 bodies.' },
  { code: 'WEB-G2-90', serial: 'WEBSEED-G290', brand: 'Contax', model: 'G2 Green Label 90mm F2', type: 'Other', day: 25, file: 'g2-90mm.jpg', note: 'Zeiss Sonnar 90mm for Contax G1 / G2.' },
  { code: 'WEB-POLA-KITTY', serial: 'WEBSEED-KITTY', brand: 'Polaroid', model: '"Hello Kitty" Polaroid 600', type: 'PnS', usd: 285, file: 'polaroid-kitty.jpg', note: 'Instant 600 camera. Same stock as the counter.' },
  { code: 'WEB-PENTAX-IQ', serial: 'WEBSEED-IQZ', brand: 'Pentax', model: 'Pentax IQZoom', type: 'PnS', day: 40, file: 'pentax-iqzoom.jpg', note: 'Compact zoom point-and-shoot, tested before it leaves the rack.' },
];

const FILMS = [
  { sku: 'WEB-FLM-ACROS120', brand: 'Fujifilm', name: 'Acros Neopan Fujifilm 100 — 120', iso: 100, size: '120', usd: 17, file: 'film-acros.jpg' },
  { sku: 'WEB-FLM-ADOXCHS', brand: 'Adox', name: 'Adox CHS II', iso: 100, size: '35mm', usd: 8, file: 'film-adox-chs.jpg' },
  { sku: 'WEB-FLM-ADOXSCA', brand: 'Adox', name: 'Adox Scala 50 — 35mm', iso: 50, size: '35mm', usd: 10, file: 'film-adox-scala.jpg' },
  { sku: 'WEB-FLM-AMBD100', brand: 'Amber', name: 'Amber D100 — 35mm', iso: 100, size: '35mm', usd: 14, file: 'film-amber-d100.jpg' },
  { sku: 'WEB-FLM-AMBT800', brand: 'Amber', name: 'Amber T800 — 35mm', iso: 800, size: '35mm', usd: 17, file: 'film-amber-t800.jpg' },
  { sku: 'WEB-FLM-P400-120', brand: 'Kodak', name: 'Kodak Portra 400 — 120', iso: 400, size: '120', usd: 16, file: 'film-portra400.jpg' },
  { sku: 'WEB-FLM-P160-120', brand: 'Kodak', name: 'Kodak Portra 160 — 120', iso: 160, size: '120', usd: 15, file: 'film-portra160.jpg' },
  { sku: 'WEB-FLM-CP200', brand: 'Kodak', name: 'Kodak ColorPlus 200 — 35mm', iso: 200, size: '35mm', usd: 13, file: 'film-colorplus.jpg' },
  { sku: 'WEB-FLM-HP5-35', brand: 'Ilford', name: 'Ilford HP5 400 — 35mm', iso: 400, size: '35mm', usd: 9, file: 'film-hp5.jpg' },
  { sku: 'WEB-FLM-CS800T', brand: 'Cinestill', name: 'CineStill 800T — 35mm', iso: 800, size: '35mm', usd: 17, file: 'film-cinestill800t.jpg' },
];

const MERCH = [
  { slug: 'web-35ti-tee', brand: 'Lab', title: '35Ti T-Shirt', usd: 40, file: 'merch-35ti-tee.jpg', excerpt: 'Lab tee. Same stock as the counter.' },
  { slug: 'web-strap-black', brand: 'Long Weekend', title: 'Adjustable Camera Neck Strap — Black', usd: 40, file: 'merch-strap-black.jpg', excerpt: 'Adjustable neck strap, black.' },
  { slug: 'web-strap-creme', brand: 'Long Weekend', title: 'Adjustable Camera Neck Strap — Creme Multi', usd: 40, file: 'merch-strap-creme.jpg', excerpt: 'Adjustable neck strap, creme multi.' },
  { slug: 'web-kodak-case', brand: 'Kodak', title: 'All Black Kodak Film Case — 135/120 8 rolls', usd: 35, file: 'merch-kodak-case.jpg', excerpt: 'Holds eight 135 or 120 rolls.' },
  { slug: 'web-xray-bag', brand: 'Lomo', title: 'Anti X-Ray Protective Lomo Film Bag', usd: 18, file: 'merch-xray-bag.jpg', excerpt: 'Airport pouch for unprocessed rolls.' },
  { slug: 'web-aperture-pin', brand: 'Lab', title: 'Aperture, Shutter, ISO Chart Guide Pin', usd: 11, file: 'merch-aperture-pin.jpg', excerpt: 'Enamel pin — exposure chart.' },
  { slug: 'web-academy-book', brand: 'Realm Books', title: 'Academy — J Daniel Hud', usd: 25, file: 'merch-academy.jpg', excerpt: 'Lab shelf book.' },
  { slug: 'web-archival-binder', brand: 'Besfile', title: 'Archival Storage Binder with Rings — Black', usd: 19, file: 'merch-binder.jpg', excerpt: 'Ring binder for sleeved negatives.' },
  { slug: 'web-lomo-tote', brand: 'Lomo', title: 'Totes Analogue LomoBag', usd: 60, file: 'merch-lomo-tote.jpg', excerpt: 'Cotton tote for a weekend of film.' },
  { slug: 'web-disposable-pin', brand: 'Lab', title: 'Flashing Disposable Camera Pin', usd: 11, file: 'merch-disposable-pin.jpg', excerpt: 'Enamel pin — disposable camera.' },
];

module.exports = { USD, DAY, img, CAMERAS, FILMS, MERCH };

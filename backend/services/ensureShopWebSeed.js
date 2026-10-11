const CameraStock = require('../models/CameraStock');
const FilmStock = require('../models/FilmStock');
const SiteContent = require('../models/SiteContent');
const { USD, DAY, img, CAMERAS, FILMS, MERCH } = require('../data/shopWebSeed');

function expiry() {
  const d = new Date();
  d.setMonth(d.getMonth() + 18);
  return d;
}

async function ensureShopWebSeed() {
  let cameras = 0;
  let films = 0;
  let merch = 0;

  for (const row of CAMERAS) {
    if (await CameraStock.findOne({ serial_number: row.serial })) continue;
    const price = row.usd != null ? row.usd * USD : row.day * DAY;
    const photo = img(row.file);
    await CameraStock.create({
      camera_code: row.code,
      model_name: row.model,
      brand: row.brand,
      brand_group: String(row.brand || 'CAM').toUpperCase(),
      camera_type: row.type,
      serial_number: row.serial,
      status: 'San_Hang',
      condition_grade: 'A',
      condition_note: row.note,
      cost: Math.round(price * 0.7),
      price,
      floor_price: Math.round(price * 0.7),
      image: photo,
      images: [photo],
      showOnWeb: true,
      webDescription: row.note,
    });
    cameras += 1;
  }

  for (const row of FILMS) {
    if (await FilmStock.findOne({ sku_code: row.sku })) continue;
    const price = row.usd * USD;
    const photo = img(row.file);
    await FilmStock.create({
      sku_code: row.sku,
      name: row.name,
      brand: row.brand,
      brand_group: String(row.brand || 'FILM').toUpperCase(),
      iso: row.iso,
      size: row.size,
      quantity: 8,
      receivedQty: 8,
      expiry_date: expiry(),
      cost: Math.round(price * 0.72),
      price,
      floor_price: Math.round(price * 0.72),
      image: photo,
      images: [photo],
      showOnWeb: true,
      webDescription: row.name,
    });
    films += 1;
  }

  for (const row of MERCH) {
    if (await SiteContent.findOne({ slug: row.slug })) continue;
    const price = Math.round(row.usd * USD);
    const photo = img(row.file);
    await SiteContent.create({
      type: 'accessory',
      title: row.title,
      slug: row.slug,
      kind: row.brand,
      excerpt: row.excerpt,
      image: photo,
      images: [photo],
      price,
      quantity: 6,
      receivedQty: 6,
      published: true,
      sort: merch,
    });
    merch += 1;
  }

  if (cameras || films || merch) {
    console.log(`   Shop seed: +${cameras} máy, +${films} film, +${merch} merch`);
  }
}

module.exports = { ensureShopWebSeed };

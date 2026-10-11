const mongoose = require('mongoose');
const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const SiteContent = require('../models/SiteContent');
const { num, daysLeft } = require('./filmChannelStock');
const { reservedMap, reserveKey } = require('./shopReservations');

function collectImages(row) {
  const out = [];
  for (const src of [row.image, ...(row.images || [])]) {
    if (src && !out.includes(src) && out.length < 9) out.push(src);
  }
  return out;
}

function applyGallery(row, images) {
  const list = (images || []).filter(Boolean).slice(0, 9);
  row.images = list;
  row.image = list[0] || '';
}

function card(row, held) {
  const quantity = num(row.quantity);
  const reserved = Math.min(quantity, num(held?.qty));
  const free = Math.max(0, quantity - reserved);
  const images = collectImages(row);
  return {
    source: row.source,
    id: String(row.id),
    sku: row.sku || '',
    brand: row.brand || '',
    title: row.title,
    kind: row.kind,
    price: num(row.price),
    quantity,
    reserved,
    reservedCodes: held?.codes || [],
    free,
    available: free > 0,
    image: images[0] || '',
    images,
    showOnWeb: Boolean(row.showOnWeb),
    description: row.description || '',
    serial: row.serial || '',
    expiry: row.expiry || '',
    daysLeft: row.daysLeft ?? null,
    receivedQty: num(row.receivedQty) > 0 ? num(row.receivedQty) : quantity,
  };
}

async function listFilmBatchCards(held) {
  const rows = await FilmStock.find({ quantity: { $gt: 0 } }).sort({ name: 1, expiry_date: 1 }).lean();
  return rows.map((row) =>
    card(
      {
        source: 'film',
        id: row._id,
        sku: row.sku_code,
        brand: row.brand || row.brand_group || 'Film',
        title: row.name,
        kind: 'Film',
        price: row.price,
        quantity: row.quantity,
        image: row.image,
        images: row.images,
        showOnWeb: row.showOnWeb,
        description: row.webDescription,
        expiry: row.expiry_date,
        daysLeft: daysLeft(row.expiry_date),
        receivedQty: row.receivedQty,
      },
      null
    )
  ).map((c) => ({ ...c, skuReserved: num(held.get(reserveKey('film', c.sku))?.qty) }));
}

async function listPublicFilmCards(held) {
  const rows = await FilmStock.find({ quantity: { $gt: 0 }, showOnWeb: true })
    .sort({ name: 1, expiry_date: 1 })
    .lean();
  const bySku = new Map();
  for (const row of rows) {
    const cur = bySku.get(row.sku_code) || {
      source: 'film',
      id: row.sku_code,
      sku: row.sku_code,
      brand: row.brand || row.brand_group || 'Film',
      title: row.name,
      kind: 'Film',
      price: row.price,
      quantity: 0,
      image: row.image,
      images: row.images,
      showOnWeb: true,
      description: row.webDescription,
      expiry: row.expiry_date,
    };
    cur.quantity += num(row.quantity);
    const extra = collectImages(row);
    cur.images = [...new Set([...(cur.images || []), ...extra])].slice(0, 9);
    if (!cur.image) cur.image = cur.images[0] || '';
    if (!cur.description && row.webDescription) cur.description = row.webDescription;
    bySku.set(row.sku_code, cur);
  }
  return [...bySku.values()].map((row) => card(row, held.get(reserveKey('film', row.sku))));
}

async function listCameraCards(held) {
  const rows = await CameraStock.find({ status: { $in: ['San_Hang', 'Cho_Sua', 'Dang_Sua'] } })
    .sort({ brand: 1, model_name: 1 })
    .lean();
  return rows.map((row) =>
    card(
      {
        source: 'camera',
        id: row._id,
        sku: row.camera_code,
        brand: row.brand || row.brand_group || 'Camera',
        title: row.model_name,
        kind: 'Máy ảnh',
        price: row.price,
        quantity: row.status === 'San_Hang' ? 1 : 0,
        image: row.image,
        images: row.images,
        showOnWeb: row.showOnWeb,
        description: row.webDescription || row.condition_note,
        serial: row.serial_number,
        receivedQty: 1,
      },
      held.get(reserveKey('camera', row._id))
    )
  );
}

async function listBatteryCards(held) {
  const rows = await BatteryStock.find().sort({ brand: 1, name: 1 }).lean();
  return rows.map((row) =>
    card(
      {
        source: 'battery',
        id: row._id,
        sku: row.sku_code,
        brand: row.brand || row.brand_group || 'Pin',
        title: row.name,
        kind: 'Pin',
        price: row.price,
        quantity: row.quantity,
        image: row.image,
        images: row.images,
        showOnWeb: row.showOnWeb,
        description: row.webDescription,
        receivedQty: row.receivedQty,
      },
      held.get(reserveKey('battery', row._id))
    )
  );
}

async function listMerchCards(held) {
  const rows = await SiteContent.find({ type: 'accessory' }).sort({ sort: 1, title: 1 }).lean();
  return rows.map((row) =>
    card(
      {
        source: 'merch',
        id: row._id,
        sku: row.slug || '',
        brand: row.kind || 'Lab',
        title: row.title,
        kind: 'Merch',
        price: row.price,
        quantity: row.quantity == null ? (row.published === false ? 0 : 1) : num(row.quantity),
        image: row.image,
        images: row.images,
        showOnWeb: row.published !== false,
        description: row.excerpt || row.body,
        receivedQty: row.receivedQty,
      },
      held.get(reserveKey('merch', row._id))
    )
  );
}

async function listShopCatalog() {
  const held = await reservedMap();
  const [film, camera, battery, merch] = await Promise.all([
    listFilmBatchCards(held),
    listCameraCards(held),
    listBatteryCards(held),
    listMerchCards(held),
  ]);
  return [...camera, ...film, ...battery, ...merch];
}

async function listPublicShop() {
  const held = await reservedMap();
  const [film, camera, battery, merch] = await Promise.all([
    listPublicFilmCards(held),
    listCameraCards(held),
    listBatteryCards(held),
    listMerchCards(held),
  ]);
  return [...camera, ...film, ...battery, ...merch]
    .filter((row) => row.showOnWeb && (row.source !== 'camera' || row.quantity > 0))
    .map(({ reservedCodes, receivedQty, skuReserved, ...row }) => row);
}

async function findPublicCard(source, id) {
  const rows = await listPublicShop();
  const key = source === 'film' ? String(id || '').toUpperCase() : String(id || '');
  return rows.find((row) => row.source === source && row.id === key) || null;
}

async function patchShopCard(source, id, { showOnWeb, image, images, description }) {
  const flag = showOnWeb === undefined ? undefined : Boolean(showOnWeb);
  const desc = description === undefined ? undefined : String(description).trim().slice(0, 1200);
  const Model = { film: FilmStock, camera: CameraStock, battery: BatteryStock }[source];
  const applyImages = (row) => {
    if (Array.isArray(images)) applyGallery(row, images);
    else if (image) applyGallery(row, [...collectImages(row), image]);
  };
  if (Model) {
    if (!mongoose.isValidObjectId(id)) {
      throw Object.assign(new Error('Món này chưa đồng bộ lên máy chủ'), { status: 400 });
    }
    const row = await Model.findById(id);
    if (!row) throw Object.assign(new Error('Không tìm thấy hàng'), { status: 404 });
    if (flag !== undefined) row.showOnWeb = flag;
    applyImages(row);
    if (desc !== undefined) row.webDescription = desc;
    row.updatedAt = Date.now();
    await row.save();
    return;
  }
  if (source === 'merch') {
    const row = await SiteContent.findById(id);
    if (!row) throw Object.assign(new Error('Không tìm thấy mục'), { status: 404 });
    if (flag !== undefined) row.published = flag;
    applyImages(row);
    if (desc !== undefined) row.excerpt = desc;
    await row.save();
    return;
  }
  throw Object.assign(new Error('Nguồn không hợp lệ'), { status: 400 });
}

module.exports = {
  listShopCatalog,
  listPublicShop,
  findPublicCard,
  patchShopCard,
};

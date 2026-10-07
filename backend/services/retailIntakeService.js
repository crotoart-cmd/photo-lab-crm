const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const {
  resolveIntakeStatus,
  syncFloorFromTrueCost,
  cameraHasDefect,
} = require('./cameraLifecycleService');
const { FILM_CATALOG, findBySku, catalogToIntakePayload: filmCatalogPayload } = require('./filmCatalogService');
const {
  fillCameraIntake,
  fillFilmIntake,
  resolveCamera,
} = require('./masterCatalogService');
const {
  CAMERA_CATALOG,
  findCatalogBySerial,
  validateCameraSerial,
  catalogToIntakePayload: cameraCatalogPayload,
  getCatalogEntry,
  resolveStoredSerial,
  isPlaceholderSerial,
} = require('./cameraSerialService');

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Giá sàn = giá nhập; giá niêm yết gợi ý từ vốn */
const suggestPricing = (cost) => {
  const c = num(cost);
  if (c <= 0) return { cost: 0, price: 0, floor_price: 0 };
  return {
    cost: c,
    price: Math.round(c * 1.38),
    floor_price: c,
  };
};

/** Danh mục mã vạch / tra cứu mẫu (mở rộng hoặc thay bằng API thật) */
const EXTERNAL_CATALOG = {
  '041771': {
    product_group: 'film',
    sku_code: 'FLM-KOD-GOLD200-35',
    barcode: '041771',
    name: 'Kodak Gold 200 (35mm)',
    brand: 'Kodak',
    brand_group: 'KODAK',
    category_cluster: 'FILM COLOR 135',
    iso: 200,
    size: '35mm',
    ...suggestPricing(140000),
    note: 'Nhận diện từ mã vạch quốc tế Kodak Gold 200',
    source: 'catalog',
  },
  '490263': {
    product_group: 'film',
    sku_code: 'FLM-FUJ-C200-35',
    barcode: '490263',
    name: 'Fujifilm C200 (35mm)',
    brand: 'Fujifilm',
    brand_group: 'FUJIFILM',
    category_cluster: 'FILM COLOR 135',
    iso: 200,
    size: '35mm',
    ...suggestPricing(125000),
    note: 'Tra cứu catalog — Fujifilm C200',
    source: 'catalog',
  },
  BAT_CR2_PAN: {
    product_group: 'battery',
    sku_code: 'BAT-CR2-PAN',
    barcode: 'BAT_CR2_PAN',
    name: 'Pin CR2 Panasonic',
    battery_type: 'CR2',
    brand: 'Panasonic',
    brand_group: 'PANASONIC',
    category_cluster: 'BATTERY CR2',
    ...suggestPricing(50000),
    note: 'Pin CR2 chính hãng',
    source: 'catalog',
  },
};

const slug = (s) =>
  String(s || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 16);

const buildCameraCode = (brand, model, serial) => {
  const b = slug(brand) || 'CAM';
  const m = slug(model) || 'MODEL';
  const sn = slug(serial).slice(-8) || 'UNKNOWN';
  return `CAM-${b}-${m}-SN${sn}`;
};

const inferGrouping = (name, productGroup) => {
  const upper = String(name || '').toUpperCase();
  let brand_group = 'OTHER';
  if (upper.includes('KODAK')) brand_group = 'KODAK';
  else if (upper.includes('FUJI')) brand_group = 'FUJIFILM';
  else if (upper.includes('ILFORD')) brand_group = 'ILFORD';
  else if (upper.includes('CANON')) brand_group = 'CANON';
  else if (upper.includes('NIKON')) brand_group = 'NIKON';
  else if (upper.includes('OLYMPUS')) brand_group = 'OLYMPUS';
  else if (upper.includes('PANASONIC')) brand_group = 'PANASONIC';

  let category_cluster = 'RETAIL OTHER';
  if (productGroup === 'film') category_cluster = 'FILM COLOR 135';
  if (productGroup === 'battery') category_cluster = 'BATTERY CONSUMABLE';
  if (productGroup === 'camera') category_cluster = 'CAMERA FILM BODY';

  return { brand_group, category_cluster };
};

const mapFilmRow = (row, source) => ({
  product_group: 'film',
  source,
  existing_id: row._id,
  sku_code: row.sku_code,
  barcode: row.barcode || row.sku_code,
  name: row.name,
  brand: row.brand,
  brand_group: row.brand_group,
  category_cluster: row.category_cluster,
  iso: row.iso,
  size: row.size,
  cost: num(row.cost),
  price: num(row.price),
  floor_price: num(row.floor_price),
  quantity_hint: num(row.quantity),
  note: `Đã có trong kho — chỉ cần nhập số lượng / lô mới`,
});

const mapBatteryRow = (row, source) => ({
  product_group: 'battery',
  source,
  existing_id: row._id,
  sku_code: row.sku_code,
  barcode: row.barcode || row.sku_code,
  name: row.name,
  battery_type: row.battery_type,
  brand: row.brand,
  brand_group: row.brand_group,
  category_cluster: row.category_cluster,
  cost: num(row.cost),
  price: num(row.price),
  floor_price: num(row.floor_price),
  quantity_hint: num(row.quantity),
  note: `SKU pin đã tồn tại — nhập thêm số lượng`,
});

const mapCameraRow = (row, source) => ({
  product_group: 'camera',
  source,
  existing_id: row._id,
  camera_code: row.camera_code,
  serial_number: row.serial_number,
  barcode: row.barcode || row.camera_code,
  name: row.model_name,
  model_name: row.model_name,
  brand_group: row.brand_group,
  category_cluster: row.category_cluster,
  cost: num(row.cost),
  price: num(row.price),
  floor_price: num(row.floor_price),
  condition_note: row.condition_note,
  note: `Máy đã có trong hệ thống (${row.status})`,
});

async function lookupLocal(code) {
  const raw = String(code || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const regex = new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  const [film, battery, camera] = await Promise.all([
    FilmStock.findOne({
      $or: [{ barcode: upper }, { sku_code: upper }, { barcode: raw }, { sku_code: raw }],
    }).sort({ updatedAt: -1 }),
    BatteryStock.findOne({
      $or: [{ barcode: upper }, { sku_code: upper }],
    }),
    CameraStock.findOne({
      $or: [
        { camera_code: upper },
        { serial_number: upper },
        { barcode: upper },
        { camera_code: regex },
      ],
    }),
  ]);

  if (film) return mapFilmRow(film, 'local');
  if (battery) return mapBatteryRow(battery, 'local');
  if (camera) return mapCameraRow(camera, 'local');
  return null;
}

function lookupCatalog(code) {
  const key = String(code || '').trim();
  const upper = key.toUpperCase();
  const hit =
    EXTERNAL_CATALOG[key] ||
    EXTERNAL_CATALOG[upper] ||
    EXTERNAL_CATALOG[key.replace(/-/g, '_').toUpperCase()];
  if (hit) return { ...hit };

  const filmHit = findBySku(upper) || FILM_CATALOG.find((f) => f.catalogKey === key.toLowerCase());
  if (filmHit) {
    return fillFilmIntake({ ...filmCatalogPayload(filmHit), ...suggestPricing(140000) });
  }

  const camBySerial = findCatalogBySerial(key);
  if (camBySerial) {
    const detected = fillCameraIntake({
      ...cameraCatalogPayload(camBySerial),
      ...suggestPricing(2500000),
    });
    const validation = validateCameraSerial(camBySerial.catalogKey, key);
    detected.serial_number = validation.normalizedSerial || key;
    detected.serial_validation = validation;
    return detected;
  }

  const camEntry =
    getCatalogEntry(key.toLowerCase()) ||
    resolveCamera({ query: key })?.entry ||
    CAMERA_CATALOG.find((c) => slug(c.model) === slug(key));
  if (camEntry) {
    return fillCameraIntake({
      ...cameraCatalogPayload(camEntry),
      ...suggestPricing(2500000),
    });
  }

  if (upper.startsWith('CAM-')) {
    const parts = upper.split('-');
    const brand = parts[1] || 'LAB';
    const model = parts[2] || 'FILM';
    const serial = parts[3] ? `SN-${parts.slice(3).join('')}` : `SN-${Date.now().toString().slice(-6)}`;
    const pricing = suggestPricing(2000000);
    const grouping = inferGrouping(`${brand} ${model}`, 'camera');
    return {
      product_group: 'camera',
      source: 'catalog',
      camera_code: upper,
      serial_number: serial.replace(/^SN/, '') || serial,
      model_name: `${brand} ${model} (Film)`,
      name: `Máy ảnh Film ${brand} ${model}`,
      brand_group: grouping.brand_group,
      category_cluster: grouping.category_cluster,
      ...pricing,
      note: 'Mã vạch Lab dán trên thân máy — nhập serial thực tế nếu khác',
    };
  }

  return null;
}

function lookupGoogleFallback(code) {
  const key = String(code || '').trim();
  const grouping = inferGrouping(key, 'film');
  const pricing = suggestPricing(100000);
  const sku = `FLM-NEW-${slug(key).slice(0, 10) || 'ITEM'}`;
  return {
    product_group: 'film',
    source: 'google_simulated',
    sku_code: sku,
    barcode: key,
    name: `Sản phẩm mới (tra cứu mã ${key})`,
    brand: '',
    brand_group: grouping.brand_group,
    category_cluster: grouping.category_cluster,
    iso: 200,
    size: '35mm',
    ...pricing,
    note: 'Mô phỏng Google Search + AI — chỉnh tên/giá trước khi lưu',
  };
}

async function scanBarcode(code) {
  const local = await lookupLocal(code);
  if (local) return local;

  const catalog = lookupCatalog(code);
  if (catalog) return catalog;

  return lookupGoogleFallback(code);
}

const VISION_MOCKS = [
  {
    brand: 'Canon',
    model: 'Autoboy Luna',
    type: 'PnS',
    condition_note: 'AI Vision: Mới ~90%, kính sạch không mốc',
    ...suggestPricing(1200000),
  },
  {
    brand: 'Olympus',
    model: 'OM-1',
    type: 'SLR',
    condition_note: 'AI Vision: SLR cổ điển, đo sáng hoạt động',
    ...suggestPricing(2800000),
  },
];

async function identifyWithOpenAI(imageBase64) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Phân tích ảnh máy ảnh film. Trả về JSON thuần: {"brand":"","model":"","type":"SLR|PnS|TLR|Other","condition_note":"","estimated_cost_vnd":number}. Tiếng Việt trong condition_note.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 400,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  const cost = num(parsed.estimated_cost_vnd, 1500000);
  const serial = `AI${Date.now().toString().slice(-6)}`;
  return fillCameraIntake({
    product_group: 'camera',
    source: 'openai_vision',
    brand: parsed.brand,
    model_name: `${parsed.brand} ${parsed.model}`.trim(),
    name: `${parsed.brand} ${parsed.model}`.trim(),
    camera_type: parsed.type,
    serial_number: serial,
    ...suggestPricing(cost),
    condition_note: parsed.condition_note || 'AI Vision nhận diện',
    note: 'GPT-4o Vision — kiểm tra hãng/model & serial trước khi lưu',
  });
}

async function identifyVision(imageBase64) {
  try {
    const ai = await identifyWithOpenAI(imageBase64);
    if (ai) return ai;
  } catch {
    // fallback mock
  }

  const mock = VISION_MOCKS[Math.floor(Math.random() * VISION_MOCKS.length)];
  const serial = String(Math.floor(100000 + Math.random() * 900000));
  return fillCameraIntake({
    product_group: 'camera',
    source: 'vision_mock',
    brand: mock.brand,
    model_name: `${mock.brand} ${mock.model}`,
    name: `${mock.brand} ${mock.model}`,
    camera_type: mock.type,
    serial_number: serial,
    cost: mock.cost,
    price: mock.price,
    floor_price: mock.floor_price,
    condition_note: mock.condition_note,
    note: 'Mô phỏng AI Vision — cấu hình OPENAI_API_KEY để nhận diện thật',
  });
}

function pushCostHistory(row, cost) {
  const c = num(cost);
  if (!row.cost_history) row.cost_history = [];
  const last = row.cost_history[row.cost_history.length - 1];
  if (last && num(last.cost) === c) return;
  row.cost_history.push({ date: new Date(), cost: c });
}

async function confirmIntake(payload) {
  const group = payload.product_group;
  const qty = Math.max(1, num(payload.quantity, 1));
  const cost = num(payload.cost);
  const price = num(payload.price);
  const floor = num(payload.floor_price) || cost;

  if (group === 'film') {
    const sku = String(payload.sku_code || '').toUpperCase();
    if (!sku) throw new Error('Thiếu SKU film');
    if (!payload.expiry_date) throw new Error('Film cần hạn sử dụng (expiry_date)');

    const row = await FilmStock.create({
      sku_code: sku,
      barcode: payload.barcode || sku,
      name: payload.name,
      brand: payload.brand,
      brand_group: payload.brand_group,
      category_cluster: payload.category_cluster,
      iso: num(payload.iso),
      film_type: payload.film_type,
      exposures: payload.exposures,
      color_character: payload.color_character,
      catalog_key: payload.catalog_key,
      size: payload.size || '35mm',
      quantity: qty,
      expiry_date: new Date(payload.expiry_date),
      cost,
      price,
      floor_price: floor,
      cost_history: [{ date: new Date(), cost }],
      notes: payload.note,
      updatedAt: Date.now(),
    });
    return { message: 'Đã nhập lô film', row, product_group: 'film' };
  }

  if (group === 'battery') {
    const sku = String(payload.sku_code || '').toUpperCase();
    if (!sku) throw new Error('Thiếu SKU pin');
    if (!payload.name) throw new Error('Thiếu tên pin');
    let row = await BatteryStock.findOne({ sku_code: sku });
    if (row) {
      row.quantity += qty;
      if (cost > 0) {
        row.cost = cost;
        pushCostHistory(row, cost);
      }
      if (price > 0) row.price = price;
      if (floor > 0) row.floor_price = floor;
      row.updatedAt = Date.now();
      await row.save();
      return { message: 'Đã cộng thêm pin vào SKU', row, product_group: 'battery' };
    }

    row = await BatteryStock.create({
      sku_code: sku,
      barcode: payload.barcode || sku,
      name: payload.name,
      battery_type: payload.battery_type || 'OTHER',
      brand: payload.brand,
      brand_group: payload.brand_group,
      category_cluster: payload.category_cluster,
      quantity: qty,
      cost,
      price,
      floor_price: floor,
      cost_history: [{ date: new Date(), cost }],
      notes: payload.note,
      updatedAt: Date.now(),
    });
    return { message: 'Đã tạo SKU pin', row, product_group: 'battery' };
  }

  if (group === 'camera') {
    const serialRaw = String(payload.serial_number || '').trim();
    const serial = serialRaw.toUpperCase();
    const model = payload.model_name || payload.name;
    if (!model) throw new Error('Thiếu tên model máy ảnh');

    const noFactorySerial = Boolean(payload.serial_is_generated);
    let code = String(payload.camera_code || '').trim().toUpperCase();
    if (!code) {
      if (serial && !isPlaceholderSerial(serial)) {
        code = buildCameraCode(payload.brand || model, model, serial);
      } else {
        throw new Error('Cần mã quầy hoặc số sê-ri máy');
      }
    }

    let estimatedYear = payload.estimated_year;
    if (payload.catalog_key && serial && !noFactorySerial) {
      const check = validateCameraSerial(payload.catalog_key, serial);
      if (check.estimatedYear) estimatedYear = check.estimatedYear;
    }

    const storedSerial = resolveStoredSerial({
      serial_number: serial && !isPlaceholderSerial(serial) ? serial : '',
      camera_code: code,
      serial_is_generated: noFactorySerial,
    });

    const catalogEntry = payload.catalog_key ? getCatalogEntry(payload.catalog_key) : null;

    const defectTags = Array.isArray(payload.defect_tags) ? payload.defect_tags : [];
    const conditionGrade = payload.condition_grade || 'A';
    const hasDefect = cameraHasDefect({
      has_defect: payload.has_defect,
      defect_tags: defectTags,
      condition_grade: conditionGrade,
      condition_note: payload.condition_note || payload.note,
    });
    const status = resolveIntakeStatus({
      ...payload,
      defect_tags: defectTags,
      condition_grade: conditionGrade,
      has_defect: hasDefect,
    });

    const row = await CameraStock.create({
      camera_code: code,
      model_name: model,
      brand: payload.brand,
      camera_type: payload.camera_type || catalogEntry?.cameraType || 'Other',
      catalog_key: payload.catalog_key,
      serial_is_generated: noFactorySerial,
      estimated_year: estimatedYear,
      serial_number: storedSerial,
      barcode: payload.barcode || code,
      brand_group: payload.brand_group,
      category_cluster: payload.category_cluster,
      condition_note: payload.condition_note || payload.note,
      condition_grade: conditionGrade,
      has_defect: hasDefect,
      defect_tags: defectTags,
      cost,
      total_repair_cost: 0,
      price,
      floor_price: floor,
      cost_history: [{ date: new Date(), cost, type: 'purchase', note: 'Nhập kho' }],
      status,
      timeline: [
        {
          at: new Date(),
          type: 'intake',
          summary: hasDefect
            ? `Nhập kho — có lỗi (${status === 'Cho_Sua' ? 'chờ sửa' : status})`
            : 'Nhập kho — sẵn hàng',
          meta: { defect_tags: defectTags, condition_grade: conditionGrade },
        },
      ],
      updatedAt: Date.now(),
    });
    syncFloorFromTrueCost(row);
    await row.save();

    const msg =
      status === 'San_Hang'
        ? 'Đã nhập máy ảnh — sẵn hàng'
        : status === 'Dang_Sua'
          ? 'Đã nhập máy ảnh — đang sửa'
          : 'Đã nhập máy ảnh — chờ sửa';
    return { message: msg, row, product_group: 'camera' };
  }

  throw new Error('Nhóm hàng không hợp lệ');
}

module.exports = {
  scanBarcode,
  identifyVision,
  confirmIntake,
  suggestPricing,
  buildCameraCode,
};

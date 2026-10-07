/**
 * Logic nhập / bán / quét — chạy trên dữ liệu lưu trong máy.
 */
import {
  loadFilmStock,
  saveFilmStock,
  loadBatteryStock,
  saveBatteryStock,
  loadCameraStock,
  saveCameraStock,
  loadSales,
  saveSales,
  newLocalId,
} from './mobileLocalDb';
import { resolveIntakeStatus } from '../constants/cameraLifecycle';

const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function upper(s) {
  return String(s || '').trim().toUpperCase();
}

export function getLocalSummary() {
  const film = loadFilmStock();
  const battery = loadBatteryStock();
  const camera = loadCameraStock();
  return {
    filmBatches: film.filter((r) => r.quantity > 0).length,
    batterySkus: battery.filter((r) => r.quantity > 0).length,
    cameraReady: camera.filter((r) => r.status === 'San_Hang').length,
    cameraWaiting: camera.filter((r) => r.status === 'Cho_Sua').length,
    cameraInRepair: camera.filter((r) => r.status === 'Dang_Sua').length,
    cameraSold: camera.filter((r) => r.status === 'Da_Ban').length,
  };
}

export function aggregateFilmSku() {
  const map = new Map();
  for (const row of loadFilmStock()) {
    if (row.quantity <= 0) continue;
    const key = row.sku_code;
    const cur = map.get(key) || {
      sku_code: key,
      name: row.name,
      iso: row.iso,
      size: row.size,
      cost: row.cost,
      price: row.price,
      floor_price: row.floor_price,
      total_quantity: 0,
      nearest_expiry: row.expiry_date,
    };
    cur.total_quantity += row.quantity;
    if (row.expiry_date && (!cur.nearest_expiry || row.expiry_date < cur.nearest_expiry)) {
      cur.nearest_expiry = row.expiry_date;
    }
    map.set(key, cur);
  }
  return [...map.values()];
}

export function resolveScanCode(code) {
  const u = upper(code);
  if (!u) return null;

  const filmAgg = aggregateFilmSku();
  const film = filmAgg.find((f) => f.sku_code === u);
  if (film) {
    return {
      product_group: 'film',
      code: film.sku_code,
      name: film.name,
      cost: num(film.cost),
      list_price: num(film.price),
      floor_price: num(film.floor_price),
      stock_qty: num(film.total_quantity),
      default_qty: 1,
      match_source: 'local',
    };
  }

  for (const row of loadFilmStock()) {
    if (row.quantity > 0 && (upper(row.barcode) === u || upper(row.sku_code) === u)) {
      return {
        product_group: 'film',
        code: row.sku_code,
        name: row.name,
        cost: num(row.cost),
        list_price: num(row.price),
        floor_price: num(row.floor_price),
        stock_qty: num(row.quantity),
        default_qty: 1,
        match_source: 'local',
      };
    }
  }

  const bat = loadBatteryStock().find(
    (b) => b.quantity > 0 && (upper(b.sku_code) === u || upper(b.barcode) === u)
  );
  if (bat) {
    return {
      product_group: 'battery',
      code: bat.sku_code,
      name: bat.name,
      cost: num(bat.cost),
      list_price: num(bat.price),
      floor_price: num(bat.floor_price),
      stock_qty: num(bat.quantity),
      default_qty: 1,
      match_source: 'local',
    };
  }

  const blocked = loadCameraStock().find(
    (c) =>
      c.status !== 'San_Hang' &&
      c.status !== 'Da_Ban' &&
      (upper(c.camera_code) === u || upper(c.serial_number) === u || upper(c.barcode) === u)
  );
  if (blocked) {
    const true_cost = num(blocked.cost) + num(blocked.total_repair_cost);
    return {
      product_group: 'camera',
      code: blocked.camera_code,
      camera_id: blocked._id,
      name: blocked.model_name || blocked.name,
      status: blocked.status,
      sale_blocked: true,
      sale_block_reason: 'Máy chưa sẵn hàng — cần sửa xong trước khi bán',
      true_cost,
      cost: num(blocked.cost),
      list_price: num(blocked.price),
      floor_price: Math.max(num(blocked.floor_price), true_cost),
      stock_qty: 0,
      default_qty: 1,
      match_source: 'local',
    };
  }

  const cam = loadCameraStock().find(
    (c) =>
      c.status === 'San_Hang' &&
      (upper(c.camera_code) === u || upper(c.serial_number) === u || upper(c.barcode) === u)
  );
  if (cam) {
    const true_cost = num(cam.cost) + num(cam.total_repair_cost);
    return {
      product_group: 'camera',
      code: cam.camera_code,
      camera_id: cam._id,
      serial_number: cam.serial_number,
      name: cam.model_name || cam.name,
      condition_note: cam.condition_note,
      cost: num(cam.cost),
      true_cost,
      total_repair_cost: num(cam.total_repair_cost),
      list_price: num(cam.price),
      floor_price: Math.max(num(cam.floor_price), true_cost),
      stock_qty: 1,
      default_qty: 1,
      match_source: 'local',
      sale_blocked: false,
    };
  }

  return null;
}

export function confirmIntakeLocal(payload) {
  const group = payload.product_group;
  const qty = Math.max(1, num(payload.quantity, 1));
  const cost = num(payload.cost);
  const price = num(payload.price);
  const floor = num(payload.floor_price) || cost;
  const now = new Date().toISOString();

  if (group === 'film') {
    const sku = upper(payload.sku_code);
    if (!sku) throw new Error('Thiếu SKU film');
    if (!payload.expiry_date) throw new Error('Film cần hạn sử dụng');

    const rows = loadFilmStock();
    const row = {
      _id: newLocalId(),
      sku_code: sku,
      barcode: payload.barcode || sku,
      name: payload.name,
      brand: payload.brand,
      brand_group: payload.brand_group,
      iso: num(payload.iso),
      size: payload.size || '35mm',
      quantity: qty,
      expiry_date: payload.expiry_date,
      cost,
      price,
      floor_price: floor,
      notes: payload.note,
      updatedAt: now,
      _local: true,
    };
    rows.push(row);
    saveFilmStock(rows);
    return { message: 'Đã lưu lô film trên máy', row, product_group: 'film' };
  }

  if (group === 'battery') {
    const sku = upper(payload.sku_code);
    if (!sku) throw new Error('Thiếu SKU pin');
    if (!payload.name) throw new Error('Thiếu tên pin');

    const rows = loadBatteryStock();
    let row = rows.find((r) => upper(r.sku_code) === sku);
    if (row) {
      row.quantity += qty;
      if (cost > 0) row.cost = cost;
      if (price > 0) row.price = price;
      if (floor > 0) row.floor_price = floor;
      row.updatedAt = now;
      row._local = true;
    } else {
      row = {
        _id: newLocalId(),
        sku_code: sku,
        barcode: payload.barcode || sku,
        name: payload.name,
        battery_type: payload.battery_type || 'OTHER',
        quantity: qty,
        cost,
        price,
        floor_price: floor,
        notes: payload.note,
        updatedAt: now,
        _local: true,
      };
      rows.push(row);
    }
    saveBatteryStock(rows);
    return { message: 'Đã lưu pin trên máy', row, product_group: 'battery' };
  }

  if (group === 'camera') {
    const serialRaw = String(payload.serial_number || '').trim();
    const serial = upper(serialRaw);
    const model = payload.model_name || payload.name;
    if (!model) throw new Error('Thiếu tên model');

    const noFactorySerial = Boolean(payload.serial_is_generated);
    let code = upper(payload.camera_code);
    if (!code) {
      if (serial && !serial.startsWith('NOSN-')) {
        code = `CAM-${serial.replace(/[^A-Z0-9]/g, '').slice(-6)}`;
      } else {
        throw new Error('Cần mã quầy hoặc số sê-ri máy');
      }
    }

    const storedSerial =
      serial && !serial.startsWith('NOSN-')
        ? serial
        : noFactorySerial || !serial
          ? `NOSN-${code}`
          : serial;

    const rows = loadCameraStock();
    if (rows.some((c) => upper(c.serial_number) === storedSerial)) {
      throw new Error('Serial đã tồn tại trên máy');
    }
    if (rows.some((c) => upper(c.camera_code) === code)) {
      throw new Error('Mã quầy đã tồn tại trên máy');
    }
    const defectTags = Array.isArray(payload.defect_tags) ? payload.defect_tags : [];
    const conditionGrade = payload.condition_grade || 'A';
    const status = resolveIntakeStatus({
      ...payload,
      defect_tags: defectTags,
      condition_grade: conditionGrade,
    });
    const hasDefect = status !== 'San_Hang';

    const row = {
      _id: newLocalId(),
      camera_code: code,
      serial_number: storedSerial,
      serial_is_generated: noFactorySerial,
      barcode: payload.barcode || code,
      model_name: model,
      name: model,
      condition_note: payload.condition_note,
      condition_grade: conditionGrade,
      has_defect: hasDefect,
      defect_tags: defectTags,
      status,
      cost,
      total_repair_cost: 0,
      price,
      floor_price: floor,
      timeline: [
        {
          at: now,
          type: 'intake',
          summary: hasDefect ? 'Nhập kho — có lỗi' : 'Nhập kho — sẵn hàng',
        },
      ],
      notes: payload.note,
      updatedAt: now,
      _local: true,
    };
    rows.push(row);
    saveCameraStock(rows);
    return { message: 'Đã lưu máy ảnh trên máy', row, product_group: 'camera' };
  }

  throw new Error('Nhóm hàng không hợp lệ');
}

function floorViolation(offer, floor) {
  if (floor > 0 && offer < floor) return `Giá offer thấp hơn giá sàn (${floor})`;
  return null;
}

export function checkSaleLocal(body) {
  const { product_group, code, quantity = 1, unit_price, camera_id, customerId, customer_name, customer_email } = body;
  const qty = num(quantity, 1);
  if (qty <= 0) throw new Error('Số lượng phải > 0');

  let itemName = '';
  let usedPrice = num(unit_price);
  let totalCost = 0;
  const saleCode = `S${Date.now().toString(36).toUpperCase()}`;

  if (product_group === 'film') {
    const sku = upper(code);
    const all = loadFilmStock();
    const rows = all
      .filter((r) => r.sku_code === sku && r.quantity > 0)
      .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));

    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
    if (totalQty < qty) throw new Error(`Tồn film không đủ. Còn ${totalQty} cuộn`);

    const ref = rows[0];
    if (!usedPrice) usedPrice = num(ref.price);
    const floorMsg = floorViolation(usedPrice, ref.floor_price);
    if (floorMsg) throw new Error(floorMsg);

    let left = qty;
    for (const batch of all) {
      if (batch.sku_code !== sku || batch.quantity <= 0 || left <= 0) continue;
      const take = Math.min(batch.quantity, left);
      batch.quantity -= take;
      totalCost += num(batch.cost) * take;
      left -= take;
    }
    saveFilmStock(all);
    itemName = ref.name || sku;
  } else if (product_group === 'battery') {
    const sku = upper(code);
    const rows = loadBatteryStock();
    const row = rows.find((r) => upper(r.sku_code) === sku);
    if (!row || row.quantity < qty) throw new Error('Tồn pin không đủ');

    if (!usedPrice) usedPrice = num(row.price);
    const floorMsg = floorViolation(usedPrice, row.floor_price);
    if (floorMsg) throw new Error(floorMsg);

    row.quantity -= qty;
    totalCost = num(row.cost) * qty;
    itemName = row.name;
    saveBatteryStock(rows);
  } else if (product_group === 'camera') {
    const rows = loadCameraStock();
    const row = camera_id
      ? rows.find((c) => c._id === camera_id)
      : rows.find((c) => upper(c.camera_code) === upper(code) && c.status === 'San_Hang');
    if (!row) throw new Error('Không tìm thấy máy ảnh');
    if (row.status !== 'San_Hang') {
      throw new Error('Máy chưa sẵn hàng — cần sửa xong trước khi bán');
    }

    const trueCost = num(row.cost) + num(row.total_repair_cost);
    if (!usedPrice) usedPrice = num(row.price);
    const effFloor = Math.max(num(row.floor_price), trueCost);
    const floorMsg = floorViolation(usedPrice, effFloor);
    if (floorMsg) throw new Error(floorMsg);

    row.status = 'Da_Ban';
    totalCost = trueCost;
    itemName = row.model_name || row.name;
    saveCameraStock(rows);
  } else {
    throw new Error('Nhóm hàng không hợp lệ');
  }

  const profit = usedPrice * qty - totalCost;
  const sale = {
    _id: newLocalId(),
    sale_code: saleCode,
    product_group,
    code: upper(code),
    name: itemName,
    quantity: qty,
    unit_price: usedPrice,
    total_amount: usedPrice * qty,
    cost: totalCost,
    profit,
    customerId: customerId || null,
    buyerName: customer_name || null,
    buyerEmail: customer_email || null,
    sold_at: new Date().toISOString(),
    _local: true,
  };

  const sales = loadSales();
  sales.unshift(sale);
  saveSales(sales);

  return { sale, profit, message: 'Đã bán — lưu trên máy' };
}

export function getLocalSalesTotals() {
  const sales = loadSales();
  return sales.reduce(
    (acc, s) => ({
      revenue: acc.revenue + num(s.total_amount),
      cost: acc.cost + num(s.cost),
      profit: acc.profit + num(s.profit),
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );
}

export function getLocalRetailSnapshot() {
  return {
    summary: getLocalSummary(),
    filmRows: loadFilmStock(),
    batteryRows: loadBatteryStock(),
    cameraRows: loadCameraStock(),
    filmSkus: aggregateFilmSku(),
    batteries: loadBatteryStock().filter((b) => b.quantity > 0),
    cameras: loadCameraStock().filter((c) => c.status === 'San_Hang'),
    sales: loadSales().slice(0, 30),
    salesTotals: getLocalSalesTotals(),
  };
}

function rowUpdatedAt(row) {
  return new Date(row?.updatedAt || row?.updated_at || 0).getTime();
}

/** Giữ bản local mới hơn khi trùng key — không để Mac backup ghi đè máy vừa nhập trên iPhone. */
function mergeLocalStock(serverRows = [], localRows = [], keyFn) {
  const localByKey = new Map(localRows.map((r) => [keyFn(r), r]));
  const serverKeys = new Set(serverRows.map(keyFn));
  const merged = [];

  for (const serverRow of serverRows) {
    const key = keyFn(serverRow);
    const localRow = localByKey.get(key);
    if (!localRow) {
      merged.push({ ...serverRow, _local: false });
      continue;
    }
    const serverAt = rowUpdatedAt(serverRow);
    const localAt = rowUpdatedAt(localRow);
    if (localAt > serverAt || (localAt === serverAt && localRow._local)) {
      merged.push({ ...localRow, _local: Boolean(localRow._local) });
    } else {
      merged.push({ ...serverRow, _local: false });
    }
  }

  for (const localRow of localRows) {
    if (localRow._local && !serverKeys.has(keyFn(localRow))) {
      merged.push({ ...localRow });
    }
  }

  return merged;
}

const cameraKey = (r) => upper(r.serial_number);
const skuKey = (r) => upper(r.sku_code);

export function cacheServerRetailData({ summary, filmRows, batteryRows, cameraRows, filmSkus, batteries, cameras, sales, salesTotals }) {
  if (summary) localStorage.setItem('nuocleo_local_summary_cache', JSON.stringify(summary));
  if (filmRows) {
    saveFilmStock(mergeLocalStock(filmRows, loadFilmStock(), skuKey));
  }
  if (batteryRows) {
    saveBatteryStock(mergeLocalStock(batteryRows, loadBatteryStock(), skuKey));
  }
  if (cameraRows) {
    saveCameraStock(mergeLocalStock(cameraRows, loadCameraStock(), cameraKey));
  }
  if (sales) saveSales(sales.map((s) => ({ ...s, _local: false })));
  return { summary, filmRows, batteryRows, cameraRows, filmSkus, batteries, cameras, sales, salesTotals };
}

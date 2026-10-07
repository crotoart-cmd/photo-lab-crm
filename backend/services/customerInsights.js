const Customer = require('../models/Customer');
const Film = require('../models/Film');
const RetailSale = require('../models/RetailSale');
const {
  digitsOnly,
  normalizeEmail,
  removeDiacritics,
  fullName,
  searchKey,
} = require('../utils/customerNormalize');

const PROCESS_LABELS = {
  c41: 'C41',
  ecn2: 'ECN-2',
  bw_standard: 'B&W',
  bw_custom: 'B&W',
  e6: 'E6',
  other: 'Khác',
};

const MS_DAY = 24 * 60 * 60 * 1000;

function processLabel(raw) {
  const key = String(raw || 'c41').toLowerCase();
  return PROCESS_LABELS[key] || 'C41';
}

function filmRevenue(film) {
  return Number(film?.intakeChecklist?.paymentAmount || 0);
}

function retailGroupLabel(group) {
  if (group === 'battery') return 'Pin';
  if (group === 'camera') return 'Máy ảnh';
  return 'Film bán lẻ';
}

function buildCustomerStats(films, retailSales = []) {
  const now = Date.now();
  const day90 = now - 90 * MS_DAY;
  const day30 = now - 30 * MS_DAY;

  let totalSpend = 0;
  let spend90d = 0;
  let visitCount = 0;
  let rollCount = 0;
  let retailSpend = 0;
  let retailCount = 0;
  let unpaidAmount = 0;
  let readyPickup = 0;
  let lastVisit = null;
  const processCount = {};

  films.forEach((film) => {
    visitCount += 1;
    rollCount += Number(film.quantity) || 1;
    const amount = filmRevenue(film);
    totalSpend += amount;
    const at = new Date(film.receivedAt || film.createdAt).getTime();
    if (at >= day90) spend90d += amount;
    if (!lastVisit || at > lastVisit) lastVisit = at;

    const proc = processLabel(film.intakeChecklist?.processingProcess || film.filmType);
    processCount[proc] = (processCount[proc] || 0) + (film.quantity || 1);

    const pay = film.intakeChecklist?.paymentStatus;
    if (pay === 'unpaid' || pay === 'deposit') {
      unpaidAmount += amount;
    }
    if (film.status === 'completed') readyPickup += 1;
  });

  retailSales.forEach((sale) => {
    retailCount += 1;
    const amount = Number(sale.total_amount || 0);
    retailSpend += amount;
    totalSpend += amount;
    const at = new Date(sale.createdAt).getTime();
    if (at >= day90) spend90d += amount;
    if (!lastVisit || at > lastVisit) lastVisit = at;
  });

  const favoriteProcess =
    Object.entries(processCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'C41';

  const daysSinceVisit = lastVisit ? Math.floor((now - lastVisit) / MS_DAY) : null;
  const totalActivity = visitCount + retailCount;
  const isNew = totalActivity <= 1 && (lastVisit ? lastVisit >= day30 : totalActivity === 0);

  return {
    visitCount,
    rollCount,
    retailCount,
    retailSpend,
    totalSpend,
    spend90d,
    unpaidAmount,
    readyPickup,
    lastVisit: lastVisit ? new Date(lastVisit).toISOString() : null,
    daysSinceVisit,
    favoriteProcess,
    processCount,
    isNew,
    inactive30d: daysSinceVisit != null && daysSinceVisit >= 30,
  };
}

function ltvGrade(stats) {
  const { spend90d = 0, visitCount = 0, retailCount = 0 } = stats;
  const activity = visitCount + retailCount;
  if (spend90d >= 2_000_000 || activity >= 6) return 'A';
  if (spend90d >= 800_000 || activity >= 3) return 'B';
  return 'C';
}

function buildTags(customer, stats) {
  const tags = [];
  const grade = ltvGrade(stats);

  if (grade === 'A') tags.push({ id: 'vip', label: 'Khách VIP', tone: 'gold' });
  if (stats.isNew) tags.push({ id: 'new', label: 'Khách mới', tone: 'blue' });
  if (stats.inactive30d) tags.push({ id: 'inactive30', label: '30 ngày chưa quay lại', tone: 'amber' });
  if ((stats.processCount?.C41 || 0) >= 3) {
    tags.push({ id: 'c41', label: 'Hay tráng C41', tone: 'purple' });
  }
  if (stats.unpaidAmount > 0) tags.push({ id: 'unpaid', label: 'Còn nợ/chưa trả đủ', tone: 'red' });
  if (stats.readyPickup > 0) {
    tags.push({ id: 'pickup', label: `${stats.readyPickup} film sẵn trả`, tone: 'green' });
  }
  if (customer.status === 'inactive') tags.push({ id: 'inactive', label: 'Ngưng hoạt động', tone: 'gray' });

  return tags;
}

function buildTimeline(customer, films, retailSales = []) {
  const items = [];

  films.forEach((film) => {
    items.push({
      id: `film-${film._id}`,
      type: 'film',
      at: film.receivedAt || film.createdAt,
      title: `Phiếu film ${film.filmCode || film.ticketNumber || ''}`.trim(),
      subtitle: `${processLabel(film.intakeChecklist?.processingProcess)} · ${film.status}`,
      amount: filmRevenue(film),
      meta: { filmId: film._id, status: film.status },
    });
    (film.statusHistory || []).forEach((h, idx) => {
      items.push({
        id: `film-hist-${film._id}-${idx}`,
        type: 'film_status',
        at: h.at,
        title: `Cập nhật: ${h.status}`,
        subtitle: h.note || film.filmCode,
        meta: { filmId: film._id },
      });
    });
  });

  retailSales.forEach((sale) => {
    items.push({
      id: `sale-${sale._id}`,
      type: 'retail',
      at: sale.createdAt,
      title: `Bán lẻ: ${sale.name || sale.code}`,
      subtitle: `${retailGroupLabel(sale.product_group)} · ${sale.sale_code}`,
      amount: Number(sale.total_amount || 0),
      meta: { saleId: sale._id, product_group: sale.product_group },
    });
  });

  if (customer.notes) {
    items.push({
      id: `note-${customer._id}`,
      type: 'note',
      at: customer.updatedAt || customer.createdAt,
      title: 'Ghi chú khách hàng',
      subtitle: customer.notes,
    });
  }

  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function nameSimilarity(a, b) {
  const na = removeDiacritics(fullName(a));
  const nb = removeDiacritics(fullName(b));
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const partsA = new Set(na.split(' ').filter(Boolean));
  const partsB = new Set(nb.split(' ').filter(Boolean));
  let overlap = 0;
  partsA.forEach((p) => {
    if (partsB.has(p)) overlap += 1;
  });
  return overlap / Math.max(partsA.size, partsB.size, 1);
}

function findDuplicateGroups(customers) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < customers.length; i += 1) {
    if (used.has(String(customers[i]._id))) continue;
    const base = customers[i];
    const baseEmail = normalizeEmail(base.email);
    const basePhone = digitsOnly(base.phone);
    const cluster = [base];

    for (let j = i + 1; j < customers.length; j += 1) {
      const other = customers[j];
      if (used.has(String(other._id))) continue;

      const otherEmail = normalizeEmail(other.email);
      const otherPhone = digitsOnly(other.phone);
      const reasons = [];

      if (baseEmail && baseEmail === otherEmail) reasons.push('email');
      if (basePhone && basePhone.length >= 9 && basePhone === otherPhone) reasons.push('phone');
      if (nameSimilarity(base, other) >= 0.75) reasons.push('name');

      if (reasons.length) cluster.push({ customer: other, reasons });
    }

    if (cluster.length > 1) {
      cluster.forEach((entry, idx) => {
        if (idx === 0) used.add(String(entry._id));
        else used.add(String(entry.customer._id));
      });
      groups.push({
        id: `dup-${base._id}`,
        reason: [...new Set(cluster.slice(1).flatMap((x) => x.reasons))],
        customers: [base, ...cluster.slice(1).map((x) => x.customer)],
      });
    }
  }

  return groups;
}

async function loadCustomerFilmsMap() {
  const films = await Film.find().select(
    'customerId filmCode ticketNumber status quantity receivedAt createdAt intakeChecklist statusHistory'
  );
  const map = new Map();
  films.forEach((film) => {
    const id = String(film.customerId);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(film);
  });
  return map;
}

async function loadRetailSalesMap() {
  const sales = await RetailSale.find().select(
    'customerId buyerEmail total_amount createdAt product_group name sale_code code'
  );
  const byCustomerId = new Map();
  sales.forEach((sale) => {
    if (!sale.customerId) return;
    const id = String(sale.customerId);
    if (!byCustomerId.has(id)) byCustomerId.set(id, []);
    byCustomerId.get(id).push(sale);
  });
  return { byCustomerId, all: sales };
}

function salesForCustomer(customer, retailMap) {
  const id = String(customer._id);
  const direct = retailMap.byCustomerId.get(id) || [];
  const email = normalizeEmail(customer.email);
  const legacy = retailMap.all.filter(
    (s) => !s.customerId && s.buyerEmail && normalizeEmail(s.buyerEmail) === email
  );
  const seen = new Set();
  return [...direct, ...legacy].filter((s) => {
    const key = String(s._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function enrichCustomer(customer, films = [], retailSales = []) {
  const stats = buildCustomerStats(films, retailSales);
  const tags = buildTags(customer, stats);
  return {
    ...customer.toObject?.() || customer,
    searchKey: searchKey(customer),
    stats,
    tags,
    ltvGrade: ltvGrade(stats),
  };
}

async function getEnrichedCustomers() {
  const [customers, filmMap, retailMap] = await Promise.all([
    Customer.find().sort({ updatedAt: -1 }),
    loadCustomerFilmsMap(),
    loadRetailSalesMap(),
  ]);
  return customers.map((c) =>
    enrichCustomer(c, filmMap.get(String(c._id)) || [], salesForCustomer(c, retailMap))
  );
}

async function getCustomerProfile(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) return null;

  const [films, retailMap] = await Promise.all([
    Film.find({ customerId }).sort({ receivedAt: -1 }),
    loadRetailSalesMap(),
  ]);
  const retailSales = salesForCustomer(customer, retailMap);
  const enriched = enrichCustomer(customer, films, retailSales);

  return {
    customer: enriched,
    timeline: buildTimeline(customer, films, retailSales),
    tags: enriched.tags,
    stats: enriched.stats,
    ltvGrade: enriched.ltvGrade,
  };
}

async function getCareTasks() {
  const enriched = await getEnrichedCustomers();
  const inactive = enriched.filter((c) => c.tags.some((t) => t.id === 'inactive30'));
  const pickup = enriched.filter((c) => c.tags.some((t) => t.id === 'pickup'));

  return {
    generatedAt: new Date().toISOString(),
    inactive30d: inactive.map((c) => ({
      id: c._id,
      name: fullName(c),
      phone: c.phone,
      email: c.email,
      daysSinceVisit: c.stats.daysSinceVisit,
      customerCode: c.customerCode,
    })),
    readyPickup: pickup.map((c) => ({
      id: c._id,
      name: fullName(c),
      phone: c.phone,
      email: c.email,
      readyCount: c.stats.readyPickup,
      customerCode: c.customerCode,
    })),
  };
}

async function mergeCustomers(keepId, removeId) {
  if (String(keepId) === String(removeId)) {
    throw new Error('Không thể gộp cùng một khách');
  }

  const [keep, remove] = await Promise.all([
    Customer.findById(keepId),
    Customer.findById(removeId),
  ]);
  if (!keep || !remove) throw new Error('Không tìm thấy khách để gộp');

  await Film.updateMany({ customerId: remove._id }, { $set: { customerId: keep._id } });
  await RetailSale.updateMany({ customerId: remove._id }, { $set: { customerId: keep._id } });

  const mergedNotes = [keep.notes, remove.notes].filter(Boolean).join('\n---\n');
  if (mergedNotes && mergedNotes !== keep.notes) {
    keep.notes = mergedNotes;
  }
  if (!keep.address && remove.address) keep.address = remove.address;
  if (!keep.city && remove.city) keep.city = remove.city;
  keep.updatedAt = new Date();
  await keep.save();
  await Customer.findByIdAndDelete(remove._id);

  return getCustomerProfile(keep._id);
}

module.exports = {
  enrichCustomer,
  getEnrichedCustomers,
  getCustomerProfile,
  getCareTasks,
  findDuplicateGroups,
  mergeCustomers,
  buildTags,
  ltvGrade,
  searchKey,
};

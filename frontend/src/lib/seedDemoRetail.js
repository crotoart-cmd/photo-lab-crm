/**
 * Nạp đơn bán demo vào localStorage — tablet/iPhone độc lập, không cần Mac.
 */
import { DEMO_PREFIX, buildSampleRetailSales } from '../data/sampleRetailSales';
import { loadSales, saveSales, newLocalId } from './mobileLocalDb';

function isDemoSale(sale) {
  return (
    String(sale?.sale_code || '').startsWith(DEMO_PREFIX) ||
    sale?.metadata?.demo === true
  );
}

/**
 * @param {{ force?: boolean }} [opts]
 * @returns {{ created: number, skipped: number, total: number }}
 */
export function seedLocalDemoRetailSales({ force = false } = {}) {
  const samples = buildSampleRetailSales();
  const existing = loadSales();
  const demoExisting = existing.filter(isDemoSale);

  if (!force && demoExisting.length >= samples.length) {
    return { created: 0, skipped: samples.length, total: demoExisting.length };
  }

  const kept = force ? existing.filter((s) => !isDemoSale(s)) : existing;
  const knownCodes = new Set(kept.map((s) => s.sale_code));

  let created = 0;
  let skipped = 0;
  const added = [];

  for (const row of samples) {
    if (!force && knownCodes.has(row.sale_code)) {
      skipped += 1;
      continue;
    }
    added.push({
      _id: newLocalId(),
      sale_code: row.sale_code,
      product_group: row.product_group,
      code: row.code,
      name: row.name,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total_amount: row.total_amount,
      cost: row.total_cost,
      profit: row.profit,
      buyerName: row.buyerName,
      sold_at: row.sold_at || row.createdAt,
      metadata: { demo: true },
      _local: true,
      _demo: true,
    });
    knownCodes.add(row.sale_code);
    created += 1;
  }

  const merged = [...added, ...kept].sort(
    (a, b) => new Date(b.sold_at || b.createdAt || 0) - new Date(a.sold_at || a.createdAt || 0)
  );
  saveSales(merged);

  const total = merged.filter(isDemoSale).length;
  return { created, skipped, total };
}

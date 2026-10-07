/** ~40 đơn demo trong 14 ngày — nhịp bán theo ngày/giờ cho dashboard (cùng logic backend). */

export const DEMO_PREFIX = 'SALE-DEMO-';

const PRODUCTS = [
  { product_group: 'film', code: 'FLM-KOD-P400', name: 'Kodak Portra 400', unit_price: 185000, unit_cost: 120000 },
  { product_group: 'film', code: 'FLM-FUJ-C200', name: 'Fujicolor C200', unit_price: 95000, unit_cost: 65000 },
  { product_group: 'film', code: 'FLM-ILF-HP5', name: 'Ilford HP5 Plus', unit_price: 165000, unit_cost: 110000 },
  { product_group: 'battery', code: 'BAT-LR44-PK', name: 'Pin LR44 (vỉ 10)', unit_price: 45000, unit_cost: 22000 },
  { product_group: 'battery', code: 'BAT-CR2', name: 'Pin CR2', unit_price: 55000, unit_cost: 28000 },
  { product_group: 'camera', code: 'CAM-AE1-01', name: 'Canon AE-1 Program', unit_price: 2800000, unit_cost: 1200000 },
  { product_group: 'camera', code: 'CAM-FM2-01', name: 'Nikon FM2', unit_price: 5200000, unit_cost: 2500000 },
  { product_group: 'camera', code: 'LENS-50-17', name: 'Ống kính 50mm f/1.7', unit_price: 890000, unit_cost: 450000 },
];

function atDayOffset(base, dayOffset, hour, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function buildSampleRetailSales() {
  const now = new Date();
  const rows = [];
  let seq = 1;

  const pushSale = (dayOffset, hour, productIndex, qty = 1) => {
    const product = PRODUCTS[productIndex % PRODUCTS.length];
    const unit_price = product.unit_price;
    const unit_cost = product.unit_cost;
    const total_amount = unit_price * qty;
    const total_cost = unit_cost * qty;
    const profit = total_amount - total_cost;
    const soldAt = atDayOffset(now, dayOffset, hour, (seq * 11) % 60);

    rows.push({
      sale_code: `${DEMO_PREFIX}${String(seq).padStart(4, '0')}`,
      product_group: product.product_group,
      code: product.code,
      name: product.name,
      quantity: qty,
      list_price: unit_price,
      unit_price,
      unit_cost,
      total_amount,
      total_cost,
      profit,
      buyerName: 'Khách demo',
      metadata: { demo: true },
      createdAt: soldAt.toISOString(),
      sold_at: soldAt.toISOString(),
    });
    seq += 1;
  };

  for (let day = 13; day >= 0; day -= 1) {
    const isWeekend = [0, 6].includes(atDayOffset(now, day, 12).getDay());
    const orders = day === 0 ? 5 : isWeekend ? 4 : day % 3 === 0 ? 3 : 2;
    const hours = day === 0 ? [10, 12, 14, 16, 18] : [9, 11, 14, 17].slice(0, orders);

    hours.forEach((hour, i) => {
      pushSale(day, hour, day * 3 + i, i === 0 && day % 4 === 0 ? 2 : 1);
    });
  }

  return rows;
}

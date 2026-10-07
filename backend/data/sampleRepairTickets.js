/**
 * 5 phiếu mẫu / trạng thái tab (tiếp nhận → đã trả) — upsert theo ticket_number.
 */
const STATUSES = [
  { status: 'tiep_nhan', code: 'TN' },
  { status: 'cho_khach_xac_nhan', code: 'CXN' },
  { status: 'dang_sua', code: 'DS' },
  { status: 'cho_tra', code: 'CT' },
  { status: 'da_tra', code: 'DT' },
];

const DEVICES = [
  { model_name: 'Canon AE-1 Program', brand: 'Canon', serial_number: 'AE1P-1001' },
  { model_name: 'Nikon FM2', brand: 'Nikon', serial_number: 'FM2-2002' },
  { model_name: 'Olympus OM-1', brand: 'Olympus', serial_number: 'OM1-3003' },
  { model_name: 'Pentax K1000', brand: 'Pentax', serial_number: 'K1K-4004' },
  { model_name: 'Minolta X-700', brand: 'Minolta', serial_number: 'X7K-5005' },
];

const SYMPTOMS = [
  'Không bật được — đèn báo pin nhấp nháy',
  'Shutter kẹt ở 1/60, cần kiểm tra curtain',
  'Light meter lệch 2–3 stop, cần hiệu chuẩn',
  'Ống kính có hơi ẩm nhẹ, cần tháo vệ sinh',
  'Film advance trượt — không kéo được cuộn',
];

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

function buildSampleRepairTickets() {
  const rows = [];
  let deviceIdx = 0;

  for (const { status, code } of STATUSES) {
    for (let i = 1; i <= 5; i += 1) {
      const device = DEVICES[deviceIdx % DEVICES.length];
      deviceIdx += 1;
      const customerSlot = (deviceIdx - 1) % 14;
      const receivedAt = daysAgo(30 - deviceIdx);
      const quoteAmount = 350000 + i * 75000;
      const partsCost = 120000 + i * 15000;
      const laborCost = 80000 + i * 10000;

      const row = {
        ticket_number: `SRV-DEMO-${code}-${String(i).padStart(2, '0')}`,
        customer_slot: customerSlot,
        model_name: device.model_name,
        brand: device.brand,
        serial_number: `${device.serial_number}-${code}${i}`,
        symptom: SYMPTOMS[(i - 1) % SYMPTOMS.length],
        condition_at_intake: 'Vỏ có xước nhẹ, kèm dây đeo',
        intake_note: `[DEMO] Phiếu test tab ${code} #${i}`,
        status,
        received_at: receivedAt,
        quote_amount: status === 'tiep_nhan' ? 0 : quoteAmount,
        quote_note:
          status === 'tiep_nhan'
            ? ''
            : 'Thay linh kiện + công sửa (demo). Bảo hành 30 ngày.',
        deposit_amount: ['dang_sua', 'cho_tra', 'da_tra'].includes(status) ? 100000 : 0,
        final_amount: status === 'da_tra' ? quoteAmount : 0,
        internal_parts_cost: ['dang_sua', 'cho_tra', 'da_tra'].includes(status) ? partsCost : 0,
        internal_labor_cost: ['dang_sua', 'cho_tra', 'da_tra'].includes(status) ? laborCost : 0,
        needs_confirm_token: status === 'cho_khach_xac_nhan',
        quote_sent_at: ['cho_khach_xac_nhan', 'dang_sua', 'cho_tra', 'da_tra'].includes(status)
          ? daysAgo(25 - i)
          : null,
        confirmed_at: ['dang_sua', 'cho_tra', 'da_tra'].includes(status) ? daysAgo(20 - i) : null,
        confirmed_via: ['dang_sua', 'cho_tra', 'da_tra'].includes(status) ? 'counter' : null,
        repair_started_at: ['dang_sua', 'cho_tra', 'da_tra'].includes(status) ? daysAgo(15 - i) : null,
        completed_at: ['cho_tra', 'da_tra'].includes(status) ? daysAgo(5 - i) : null,
        returned_at: status === 'da_tra' ? daysAgo(2) : null,
        intake_email_sent_at: daysAgo(28 - i),
        quote_email_sent_at: ['cho_khach_xac_nhan', 'dang_sua', 'cho_tra', 'da_tra'].includes(status)
          ? daysAgo(25 - i)
          : null,
        ready_email_sent_at: ['cho_tra', 'da_tra'].includes(status) ? daysAgo(3) : null,
        work_logs:
          status === 'dang_sua' || status === 'cho_tra' || status === 'da_tra'
            ? [
                {
                  description: 'Thay gioăng light seal + vệ sinh shutter',
                  vendor: 'Xưởng nội bộ',
                  parts_cost: partsCost,
                  labor_cost: laborCost,
                  total_cost: partsCost + laborCost,
                  at: daysAgo(10 - i),
                },
              ]
            : [],
      };

      rows.push(row);
    }
  }

  return rows;
}

module.exports = {
  STATUSES,
  buildSampleRepairTickets,
};

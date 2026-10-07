const crypto = require('crypto');
const Customer = require('../models/Customer');
const CustomerRepairTicket = require('../models/CustomerRepairTicket');
const { SAMPLE_CUSTOMERS } = require('./ensureSampleCustomers');
const { buildSampleRepairTickets } = require('../data/sampleRepairTickets');
const { pushRepairStatusHistory } = require('../utils/repairHelpers');

/**
 * Tạo 5 phiếu demo / mỗi tab trạng thái (25 phiếu) — upsert theo ticket_number.
 */
async function ensureSampleRepairTickets() {
  const samples = buildSampleRepairTickets();
  let created = 0;

  const customers = await Customer.find({
    email: { $in: SAMPLE_CUSTOMERS.map((c) => String(c.email).trim().toLowerCase()) },
  }).lean();

  const customerByEmail = new Map(customers.map((c) => [c.email.toLowerCase(), c]));

  for (const row of samples) {
    const existing = await CustomerRepairTicket.findOne({ ticket_number: row.ticket_number });
    if (existing) continue;

    const sampleCustomer = SAMPLE_CUSTOMERS[row.customer_slot % SAMPLE_CUSTOMERS.length];
    const email = String(sampleCustomer.email).trim().toLowerCase();
    const linked = customerByEmail.get(email);
    const customer_name = `${sampleCustomer.firstName} ${sampleCustomer.lastName}`.trim();

    const ticket = new CustomerRepairTicket({
      ticket_number: row.ticket_number,
      customerId: linked?._id || null,
      customer_name,
      customer_email: email,
      customer_phone: sampleCustomer.phone || '',
      model_name: row.model_name,
      brand: row.brand,
      serial_number: row.serial_number,
      symptom: row.symptom,
      condition_at_intake: row.condition_at_intake,
      intake_note: row.intake_note,
      status: row.status,
      quote_amount: row.quote_amount,
      quote_note: row.quote_note,
      deposit_amount: row.deposit_amount,
      final_amount: row.final_amount,
      internal_parts_cost: row.internal_parts_cost,
      internal_labor_cost: row.internal_labor_cost,
      received_at: row.received_at,
      quote_sent_at: row.quote_sent_at,
      confirmed_at: row.confirmed_at,
      confirmed_via: row.confirmed_via,
      repair_started_at: row.repair_started_at,
      completed_at: row.completed_at,
      returned_at: row.returned_at,
      intake_email_sent_at: row.intake_email_sent_at,
      quote_email_sent_at: row.quote_email_sent_at,
      ready_email_sent_at: row.ready_email_sent_at,
      work_logs: row.work_logs,
      confirm_token: row.needs_confirm_token ? crypto.randomBytes(24).toString('hex') : undefined,
      confirm_token_expires: row.needs_confirm_token
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : undefined,
      statusHistory: [],
      createdAt: row.received_at,
      updatedAt: new Date(),
    });

    pushRepairStatusHistory(ticket, 'tiep_nhan', 'Tiếp nhận (demo)', null);
    if (row.status !== 'tiep_nhan') {
      pushRepairStatusHistory(ticket, row.status, `Trạng thái demo: ${row.status}`, null);
    }

    await ticket.save();
    created += 1;
  }

  if (created > 0) {
    const total = await CustomerRepairTicket.countDocuments();
    console.log(`✅ Phiếu sửa mẫu: thêm ${created} (tổng ${total} trong DB)`);
  }

  return { created, total: await CustomerRepairTicket.countDocuments() };
}

module.exports = { ensureSampleRepairTickets };

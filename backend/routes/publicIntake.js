const express = require('express');
const crypto = require('crypto');
const Film = require('../models/Film');
const { sendConfirmationEmail } = require('../services/emailService');
const { generateTicketNumber, pushStatusHistory } = require('../utils/filmHelpers');
const { filmTypeFromDetail, normalizeIntakeChecklist } = require('../utils/intakeChecklist');
const { createTicket } = require('../services/customerRepairService');
const {
  tooManyRequests,
  isHoneypot,
  findOrCreateWebCustomer,
  pickPublicChecklist,
  clampQuantity,
  str,
} = require('../utils/webIntake');

const router = express.Router();

const generateFilmCode = () => `FM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
const generateConfirmationCode = () => crypto.randomBytes(6).toString('hex').toUpperCase();

function fail(res, err) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  return res.status(status).json({
    message: err.status === 400 || err.name === 'ValidationError' ? err.message : 'Không gửi được đơn',
  });
}

router.post('/film', async (req, res) => {
  try {
    if (tooManyRequests(req)) {
      return res.status(429).json({ message: 'Bạn gửi quá nhiều đơn. Thử lại sau.' });
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, ticketNumber: 'PH-OK' });
    }

    const customer = await findOrCreateWebCustomer(req.body);
    const quantity = clampQuantity(req.body.quantity);
    const checklist = normalizeIntakeChecklist(pickPublicChecklist(req.body, customer), customer);
    checklist.checklistCompletedAt = new Date();

    const filmType = filmTypeFromDetail(checklist.filmTypeDetail) || 'color';
    const ticketNumber = await generateTicketNumber();
    const note = str(req.body.receptionNotes, 800);

    const film = new Film({
      customerId: customer._id,
      ticketNumber,
      filmCode: generateFilmCode(),
      confirmationCode: generateConfirmationCode(),
      quantity,
      filmType,
      receptionNotes: note ? `Đơn web: ${note}` : 'Đơn web khách gửi',
      intakeChecklist: checklist,
      status: 'received',
    });

    pushStatusHistory(film, 'received', 'Khách gửi đơn trên web', null);
    await film.save();

    const slip = await Film.findById(film._id).populate('customerId');
    const emailResult = await sendConfirmationEmail(slip);
    if (emailResult.sent) {
      film.emailSentAt = Date.now();
      await film.save();
    }

    res.status(201).json({
      ok: true,
      ticketNumber,
      message: emailResult.sent
        ? `Đã nhận đơn ${ticketNumber}. Lab gửi email xác nhận.`
        : `Đã nhận đơn ${ticketNumber}. Lab liên hệ qua email bạn ghi.`,
    });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/repair', async (req, res) => {
  try {
    if (tooManyRequests(req)) {
      return res.status(429).json({ message: 'Bạn gửi quá nhiều đơn. Thử lại sau.' });
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, ticketNumber: 'SRV-OK' });
    }

    const customer = await findOrCreateWebCustomer({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email || req.body.customer_email,
      phone: req.body.phone || req.body.customer_phone,
      address: req.body.address,
      city: req.body.city,
      postalCode: req.body.postalCode,
    });

    const extra = str(req.body.intake_note, 800);
    const { ticket, emailResult } = await createTicket(
      {
        customerId: customer._id,
        customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
        customer_email: customer.email,
        customer_phone: customer.phone,
        model_name: str(req.body.model_name, 120),
        brand: str(req.body.brand, 80),
        serial_number: str(req.body.serial_number, 80),
        symptom: str(req.body.symptom, 800),
        condition_at_intake: str(req.body.condition_at_intake, 800),
        intake_note: extra ? `Đơn web: ${extra}` : 'Đơn web khách gửi',
      },
      null
    );

    res.status(201).json({
      ok: true,
      ticketNumber: ticket.ticket_number,
      message: emailResult?.sent
        ? `Đã nhận phiếu ${ticket.ticket_number}. Lab gửi email xác nhận.`
        : `Đã nhận phiếu ${ticket.ticket_number}. Lab liên hệ qua email bạn ghi.`,
    });
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;

const express = require('express');
const crypto = require('crypto');
const { repairMediaUpload, ACKNOWLEDGMENT_VERSION } = require('../lib/repairMedia');
const Film = require('../models/Film');
const { sendConfirmationEmail } = require('../services/emailService');
const { generateTicketNumber, pushStatusHistory } = require('../utils/filmHelpers');
const { filmTypeFromDetail, normalizeIntakeChecklist } = require('../utils/intakeChecklist');
const { createTicket } = require('../services/customerRepairService');
const { listPublicShop } = require('../services/shopCatalog');
const { createShopOrder } = require('../services/shopOrders');
const { createPrintOrder } = require('../services/printOrderService');
const { createScanOrder } = require('../services/scanOrderService');
const { tooManyRequests } = require('../middleware/rateLimit');
const { issueCaptcha, assertPublicCaptcha } = require('../lib/publicCaptcha');
const {
  publicIntakeIpBlocked,
  publicIntakeEmailBlocked,
  isHoneypot,
  findOrCreateWebCustomer,
  pickPublicChecklist,
  clampQuantity,
  str,
} = require('../utils/webIntake');

const router = express.Router();

const generateFilmCode = () => `FM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
const generateConfirmationCode = () => crypto.randomBytes(6).toString('hex').toUpperCase();

function limited(res, message) {
  res.setHeader('Retry-After', '3600');
  return res.status(429).json({ message });
}

function fail(res, err) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  return res.status(status).json({
    message: err.status === 400 || err.name === 'ValidationError' ? err.message : 'Không gửi được đơn',
  });
}

router.get('/captcha', (req, res) => {
  if (tooManyRequests(req, 40, 60 * 60 * 1000, 'captcha-get')) {
    return limited(res, 'Quá nhiều yêu cầu. Thử lại sau.');
  }
  const issued = issueCaptcha();
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ token: issued.token, image: issued.image });
});

router.get('/shop', async (_req, res) => {
  try {
    const items = await listPublicShop();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Không tải được cửa hàng' });
  }
});

router.post('/shop/orders', async (req, res) => {
  try {
    if (publicIntakeIpBlocked(req, 'shop') || publicIntakeEmailBlocked(req.body?.email, 'shop')) {
      return limited(res, 'Bạn đặt quá nhiều đơn. Thử lại sau.');
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, code: 'WEB-OK' });
    }
    assertPublicCaptcha(req.body);
    const customer = await findOrCreateWebCustomer({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.delivery === 'ship' ? req.body.address : undefined,
    });
    const order = await createShopOrder({
      items: req.body.items,
      customer,
      delivery: req.body.delivery,
      address: str(req.body.address, 400),
      note: str(req.body.note, 600),
    });
    res.status(201).json({
      ok: true,
      code: order.code,
      total: order.total,
      holdUntil: order.holdUntil,
    });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ message: error.message });
    fail(res, error);
  }
});

router.post('/scan', async (req, res) => {
  try {
    if (publicIntakeIpBlocked(req, 'scan') || publicIntakeEmailBlocked(req.body?.email, 'scan')) {
      return limited(res, 'Bạn gửi quá nhiều đơn. Thử lại sau.');
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, code: 'SC-OK' });
    }
    assertPublicCaptcha(req.body);

    const customer = await findOrCreateWebCustomer(req.body);
    const order = await createScanOrder({ body: req.body, customer });

    res.status(201).json({
      ok: true,
      code: order.code,
      message: `Đã nhận yêu cầu scan ${order.code}. Lab gửi file qua email bạn ghi.`,
    });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/print', async (req, res) => {
  try {
    if (publicIntakeIpBlocked(req, 'print') || publicIntakeEmailBlocked(req.body?.email, 'print')) {
      return limited(res, 'Bạn gửi quá nhiều đơn. Thử lại sau.');
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, code: 'IN-OK' });
    }
    assertPublicCaptcha(req.body);

    const customer = await findOrCreateWebCustomer(req.body);
    const order = await createPrintOrder({ body: req.body, customer });

    res.status(201).json({
      ok: true,
      code: order.code,
      message: `Đã nhận yêu cầu in ${order.code}. Lab liên hệ qua email bạn ghi để báo giá.`,
    });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/film', async (req, res) => {
  try {
    if (publicIntakeIpBlocked(req, 'film') || publicIntakeEmailBlocked(req.body?.email, 'film')) {
      return limited(res, 'Bạn gửi quá nhiều đơn. Thử lại sau.');
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, ticketNumber: 'PH-OK' });
    }
    assertPublicCaptcha(req.body);

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
      status: 'web_order',
    });

    pushStatusHistory(film, 'web_order', 'Khách gửi đơn trên web', null);
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

router.post('/repair', (req, res, next) => {
  if (publicIntakeIpBlocked(req, 'repair')) {
    return limited(res, 'Quá nhiều yêu cầu. Thử lại sau.');
  }
  return next();
}, repairMediaUpload, async (req, res) => {
  try {
    if (publicIntakeEmailBlocked(req.body?.email || req.body?.customer_email, 'repair')) {
      return limited(res, 'Quá nhiều yêu cầu. Thử lại sau.');
    }
    if (isHoneypot(req.body)) {
      return res.status(201).json({ ok: true, ticketNumber: 'SRV-OK' });
    }
    assertPublicCaptcha(req.body);

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
    const submittedAt = new Date();
    const submission = {
      submitted_at: submittedAt,
      model_name: str(req.body.model_name, 120),
      brand: str(req.body.brand, 80),
      serial_number: str(req.body.serial_number, 80),
      symptom: str(req.body.symptom, 800),
      condition_at_intake: str(req.body.condition_at_intake, 800),
    };
    const media = req.repairMedia?.files || [];
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
        source: 'web',
      },
      null,
      {
        media: media.length ? media : undefined,
        submission,
        acknowledgedAt: media.length ? submittedAt : undefined,
        acknowledgmentVersion: media.length ? ACKNOWLEDGMENT_VERSION : undefined,
        onBeforePersist: () => { if (req.repairMedia) req.repairMedia.persistStarted = true; },
        onPersisted: () => { if (req.repairMedia) req.repairMedia.committed = true; },
      }
    );

    res.status(201).json({
      ok: true,
      ticketNumber: ticket.ticket_number,
      mediaCount: media.length,
      message: emailResult?.sent
        ? `Đã nhận phiếu ${ticket.ticket_number}. Lab gửi email xác nhận.`
        : `Đã nhận phiếu ${ticket.ticket_number}. Lab liên hệ qua email bạn ghi.`,
    });
  } catch (error) {
    // On an uncertain database write, retain the private batch for reconciliation.
    if (req.repairMedia?.persistStarted && !error.status && error.name !== 'ValidationError') req.repairMedia.committed = true;
    fail(res, error);
  } finally {
    await req.repairMedia?.dispose();
  }
});

module.exports = router;

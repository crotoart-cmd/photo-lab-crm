const crypto = require('crypto');
const Customer = require('../models/Customer');
const { validateCustomerInput, normalizeEmail } = require('./customerNormalize');
const { clientIp, isSharedProxyPeer, tooManyRequests } = require('../middleware/rateLimit');
const {
  FILM_FORMATS,
  FILM_TYPE_DETAILS,
  PROCESSING_PROCESSES,
  LEADER_STATUS,
  CANISTER_CONDITIONS,
  FILM_STUCK,
  WET_MOLD,
  ISO_HANDLING,
  CUT_FILM,
  SCAN_FORMATS,
  SCAN_RESOLUTIONS,
  COLOR_TONES,
  ORIGINAL_RETURN,
} = require('../data/intakeOptions');

const HOUR = 60 * 60 * 1000;

function publicIntakeIpBlocked(req, bucket) {
  if (process.env.NODE_ENV !== 'production' && isSharedProxyPeer(clientIp(req))) return false;
  const shared = isSharedProxyPeer(clientIp(req));
  return tooManyRequests(req, shared ? 80 : 8, HOUR, shared ? `public-proxy:${bucket}` : `public-ip:${bucket}`);
}

function publicIntakeEmailBlocked(email, bucket) {
  if (process.env.NODE_ENV !== 'production') return false;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const id = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  return tooManyRequests({ ip: id }, 5, HOUR, `public-mail:${bucket}`);
}

function isHoneypot(body) {
  return Boolean(String(body?.website || '').trim());
}

function pickEnum(options, value, fallback) {
  const allowed = options.map((o) => o.value);
  return allowed.includes(value) ? value : fallback;
}

function str(value, max = 400) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

async function findOrCreateWebCustomer(body) {
  const { errors, normalized } = validateCustomerInput({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    address: body.address,
    city: body.city,
    postalCode: body.postalCode,
    notes: 'Nguồn: form web',
  });
  if (errors.length) {
    const err = new Error(errors.join('. '));
    err.status = 400;
    throw err;
  }

  // Email is the only public identity. Matching by phone attached a stranger's order,
  // and the confirmation email, to another customer's record.
  let customer = await Customer.findOne({ email: normalized.email });
  if (customer) return customer;

  customer = new Customer({
    ...normalized,
    notes: 'Nguồn: form web',
  });
  await customer.save();
  return customer;
}

function pickPublicChecklist(raw = {}, customer) {
  const filmStuck = pickEnum(FILM_STUCK, raw.filmStuckBroken, 'no');
  const stuck =
    filmStuck === 'yes_found_on_inspection' ? 'yes_customer_reported' : filmStuck;

  return {
    filmFormat: pickEnum(FILM_FORMATS, raw.filmFormat, '35mm'),
    filmFormatNote: str(raw.filmFormatNote, 200),
    filmTypeDetail: pickEnum(FILM_TYPE_DETAILS, raw.filmTypeDetail, 'color_negative'),
    processingProcess: pickEnum(PROCESSING_PROCESSES, raw.processingProcess, 'c41'),
    processingProcessNote: str(raw.processingProcessNote, 200),
    leaderStatus: pickEnum(LEADER_STATUS, raw.leaderStatus, 'unknown'),
    canisterCondition: pickEnum(CANISTER_CONDITIONS, raw.canisterCondition, 'ok'),
    canisterConditionNote: str(raw.canisterConditionNote, 200),
    filmStuckBroken: stuck,
    filmStuckBrokenNote: str(raw.filmStuckBrokenNote, 200),
    wetMold: pickEnum(WET_MOLD, raw.wetMold, 'no'),
    wetMoldNote: str(raw.wetMoldNote, 200),
    isoHandling: pickEnum(ISO_HANDLING, raw.isoHandling, 'box_speed'),
    isoValue: raw.isoValue,
    pushPullStops: raw.pushPullStops,
    cutFilm: pickEnum(CUT_FILM, raw.cutFilm, 'cut_strips'),
    scanFileFormat: pickEnum(SCAN_FORMATS, raw.scanFileFormat, 'jpeg'),
    scanResolution: pickEnum(SCAN_RESOLUTIONS, raw.scanResolution, 'm'),
    scanResolutionNote: str(raw.scanResolutionNote, 200),
    colorTone: pickEnum(COLOR_TONES, raw.colorTone, 'natural'),
    colorToneNote: str(raw.colorToneNote, 200),
    technicalNotes: str(raw.technicalNotes, 800),
    contactVerified: true,
    contactName: `${customer.firstName} ${customer.lastName}`.trim(),
    contactPhone: customer.phone,
    contactEmail: customer.email,
    promisedReturnAt: raw.promisedReturnAt || undefined,
    originalFilmReturn: pickEnum(ORIGINAL_RETURN, raw.originalFilmReturn, 'pickup_at_lab'),
    shippingAddress: str(raw.shippingAddress || raw.address, 400),
    paymentStatus: 'unpaid',
    inspectedBy: '',
  };
}

function clampQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(20, Math.round(n));
}

module.exports = {
  tooManyRequests,
  publicIntakeIpBlocked,
  publicIntakeEmailBlocked,
  isHoneypot,
  findOrCreateWebCustomer,
  pickPublicChecklist,
  clampQuantity,
  str,
};

const filmTypeFromDetail = (detail) => {
  const map = {
    color_negative: 'color',
    black_white: 'black_white',
    slide_e6: 'slide',
  };
  return map[detail] || 'color';
};

const defaultProcessingForType = (filmTypeDetail) => {
  const map = {
    color_negative: 'c41',
    black_white: 'bw_standard',
    slide_e6: 'e6',
  };
  return map[filmTypeDetail] || 'c41';
};

const toNumber = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

const normalizeIntakeChecklist = (raw = {}, customer = null) => {
  const checklist = { ...raw };

  if (customer && !checklist.contactName) {
    checklist.contactName = `${customer.firstName} ${customer.lastName}`.trim();
    checklist.contactPhone = customer.phone;
    checklist.contactEmail = customer.email;
  }

  checklist.isoValue = toNumber(checklist.isoValue);
  checklist.pushPullStops = toNumber(checklist.pushPullStops);
  checklist.paymentAmount = toNumber(checklist.paymentAmount);

  if (checklist.promisedReturnAt) {
    checklist.promisedReturnAt = new Date(checklist.promisedReturnAt);
  } else {
    delete checklist.promisedReturnAt;
  }

  delete checklist.quantity;

  return checklist;
};

module.exports = {
  filmTypeFromDetail,
  defaultProcessingForType,
  normalizeIntakeChecklist,
};

const { SALABLE_STATUSES, DEFECT_RE } = require('../constants/cameraLifecycle');

const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function computeTrueCost(camera) {
  return num(camera?.cost) + num(camera?.total_repair_cost);
}

function cameraHasDefect(camera) {
  if (!camera) return false;
  if (camera.has_defect) return true;
  if (Array.isArray(camera.defect_tags) && camera.defect_tags.length > 0) return true;
  if (camera.condition_grade && camera.condition_grade !== 'A') return true;
  return DEFECT_RE.test(camera.condition_note || '');
}

function resolveIntakeStatus(payload) {
  const grade = payload.condition_grade || 'A';
  const tags = payload.defect_tags || [];
  const flagged =
    payload.has_defect ||
    tags.length > 0 ||
    grade !== 'A' ||
    DEFECT_RE.test(payload.condition_note || '');

  if (!flagged) return 'San_Hang';
  if (payload.force_ready) return 'San_Hang';
  return payload.intake_status === 'Dang_Sua' ? 'Dang_Sua' : 'Cho_Sua';
}

function appendTimeline(camera, entry) {
  if (!camera.timeline) camera.timeline = [];
  camera.timeline.unshift({
    at: new Date(),
    ...entry,
  });
  if (camera.timeline.length > 50) camera.timeline.length = 50;
}

function syncFloorFromTrueCost(camera) {
  const trueCost = computeTrueCost(camera);
  if (trueCost > num(camera.floor_price)) {
    camera.floor_price = trueCost;
  }
  return trueCost;
}

function isSaleBlocked(camera, { sell_as_is = false } = {}) {
  if (!camera) return { blocked: true, reason: 'Không tìm thấy máy' };
  if (camera.status === 'Da_Ban') {
    return { blocked: true, reason: 'Máy đã bán' };
  }
  if (SALABLE_STATUSES.includes(camera.status)) {
    return { blocked: false };
  }
  if (sell_as_is && (camera.status === 'Cho_Sua' || camera.status === 'Dang_Sua')) {
    return { blocked: false, asIs: true };
  }
  const labels = { Cho_Sua: 'chờ sửa', Dang_Sua: 'đang sửa' };
  return {
    blocked: true,
    reason: `Máy đang ${labels[camera.status] || camera.status} — chưa thể bán thường`,
  };
}

function mapCameraForClient(camera) {
  const true_cost = computeTrueCost(camera);
  const saleCheck = isSaleBlocked(camera);
  return {
    ...camera,
    true_cost,
    purchase_cost: num(camera.cost),
    has_defect: cameraHasDefect(camera),
    sale_blocked: saleCheck.blocked,
    sale_block_reason: saleCheck.reason || null,
  };
}

function buildSaleMetadata(camera, repairs = []) {
  return {
    serial_number: camera.serial_number,
    camera_code: camera.camera_code,
    condition_at_sale: camera.condition_note,
    condition_grade: camera.condition_grade,
    defect_tags: camera.defect_tags || [],
    purchase_cost: num(camera.cost),
    total_repair_cost: num(camera.total_repair_cost),
    true_cost: computeTrueCost(camera),
    repair_events: repairs.length,
    status_at_sale: camera.status,
  };
}

module.exports = {
  computeTrueCost,
  cameraHasDefect,
  resolveIntakeStatus,
  appendTimeline,
  syncFloorFromTrueCost,
  isSaleBlocked,
  mapCameraForClient,
  buildSaleMetadata,
  num,
};

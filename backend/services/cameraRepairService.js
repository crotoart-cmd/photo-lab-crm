const CameraStock = require('../models/CameraStock');
const CameraRepairEvent = require('../models/CameraRepairEvent');
const {
  computeTrueCost,
  appendTimeline,
  syncFloorFromTrueCost,
  mapCameraForClient,
  num,
} = require('./cameraLifecycleService');
const { STATUS_LABELS } = require('../constants/cameraLifecycle');

async function getCameraProfile(cameraId) {
  const camera = await CameraStock.findById(cameraId).lean();
  if (!camera) return null;

  const repairs = await CameraRepairEvent.find({ camera_id: cameraId })
    .sort({ date: -1 })
    .lean();

  return {
    camera: mapCameraForClient(camera),
    repairs,
    true_cost: computeTrueCost(camera),
  };
}

async function addRepairEvent(cameraId, payload, userId) {
  const camera = await CameraStock.findById(cameraId);
  if (!camera) {
    const err = new Error('Không tìm thấy máy ảnh');
    err.status = 404;
    throw err;
  }
  if (camera.status === 'Da_Ban') {
    const err = new Error('Máy đã bán — không thể thêm phiếu sửa');
    err.status = 400;
    throw err;
  }

  const parts = num(payload.parts_cost);
  const labor = num(payload.labor_cost);
  const total = parts + labor;
  const description = String(payload.description || '').trim();
  if (!description) {
    const err = new Error('Mô tả công việc sửa chữa là bắt buộc');
    err.status = 400;
    throw err;
  }

  const repair = await CameraRepairEvent.create({
    camera_id: cameraId,
    date: payload.date ? new Date(payload.date) : new Date(),
    vendor: payload.vendor || '',
    description,
    parts_cost: parts,
    labor_cost: labor,
    total_cost: total,
    before_note: payload.before_note || camera.condition_note,
    after_note: payload.after_note || '',
    resolved_tags: payload.resolved_tags || [],
    mark_ready: Boolean(payload.mark_ready),
    createdBy: userId,
  });

  if (total > 0) {
    camera.total_repair_cost = num(camera.total_repair_cost) + total;
    camera.cost_history.push({
      date: repair.date,
      cost: total,
      type: 'repair',
      note: description,
    });
  }

  if (payload.after_note) camera.condition_note = payload.after_note;
  if (payload.condition_grade) camera.condition_grade = payload.condition_grade;

  if (Array.isArray(payload.resolved_tags) && payload.resolved_tags.length) {
    const remaining = (camera.defect_tags || []).filter((t) => !payload.resolved_tags.includes(t));
    camera.defect_tags = remaining;
    camera.has_defect = remaining.length > 0 || camera.condition_grade !== 'A';
  }

  if (payload.mark_in_progress) {
    camera.status = 'Dang_Sua';
  } else if (payload.mark_ready || repair.mark_ready) {
    camera.status = 'San_Hang';
    if (!camera.defect_tags?.length && camera.condition_grade === 'A') {
      camera.has_defect = false;
    }
  } else if (camera.status === 'San_Hang' && total > 0) {
    camera.status = 'Dang_Sua';
  }

  syncFloorFromTrueCost(camera);

  appendTimeline(camera, {
    type: 'repair',
    summary: `Sửa: ${description}${total > 0 ? ` — ${total.toLocaleString('vi-VN')}đ` : ''}`,
    meta: { repair_id: repair._id, total_cost: total },
  });

  camera.updatedAt = Date.now();
  await camera.save();

  return { camera: mapCameraForClient(camera.toObject()), repair };
}

async function updateCameraStatus(cameraId, status, note) {
  const camera = await CameraStock.findById(cameraId);
  if (!camera) {
    const err = new Error('Không tìm thấy máy ảnh');
    err.status = 404;
    throw err;
  }
  if (camera.status === 'Da_Ban') {
    const err = new Error('Máy đã bán');
    err.status = 400;
    throw err;
  }

  const prev = camera.status;
  camera.status = status;
  camera.updatedAt = Date.now();

  appendTimeline(camera, {
    type: 'status',
    summary: `${STATUS_LABELS[prev] || prev} → ${STATUS_LABELS[status] || status}${note ? `: ${note}` : ''}`,
    meta: { from: prev, to: status },
  });

  await camera.save();
  return mapCameraForClient(camera.toObject());
}

async function getRepairOpsSummary() {
  const now = Date.now();
  const [waiting, inRepair, repairedSold, repairsThisMonth] = await Promise.all([
    CameraStock.find({ status: 'Cho_Sua' }).select('model_name camera_code createdAt cost total_repair_cost').lean(),
    CameraStock.find({ status: 'Dang_Sua' }).select('model_name camera_code updatedAt cost total_repair_cost').lean(),
    CameraStock.find({ status: 'Da_Ban', total_repair_cost: { $gt: 0 } })
      .select('model_name camera_code cost total_repair_cost sold_price sold_at')
      .lean(),
    CameraRepairEvent.find({
      date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    }).lean(),
  ]);

  const repairSpendMonth = repairsThisMonth.reduce((s, r) => s + num(r.total_cost), 0);

  const longWaiting = waiting
    .map((c) => ({
      ...c,
      daysWaiting: Math.ceil((now - new Date(c.createdAt).getTime()) / 86400000),
      true_cost: computeTrueCost(c),
    }))
    .filter((c) => c.daysWaiting >= 7)
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 8);

  const roiAfterRepair = repairedSold
    .map((c) => {
      const trueCost = computeTrueCost(c);
      const sold = num(c.sold_price);
      return {
        model: c.model_name,
        code: c.camera_code,
        true_cost: trueCost,
        sold_price: sold,
        profit: sold - trueCost,
        repair_cost: num(c.total_repair_cost),
      };
    })
    .filter((r) => r.repair_cost > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return {
    counts: {
      waiting: waiting.length,
      inRepair: inRepair.length,
      repairSpendMonth,
      repairedSoldCount: repairedSold.length,
    },
    longWaiting,
    roiAfterRepair,
  };
}

module.exports = {
  getCameraProfile,
  addRepairEvent,
  updateCameraStatus,
  getRepairOpsSummary,
};

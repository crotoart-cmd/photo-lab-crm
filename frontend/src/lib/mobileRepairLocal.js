/**
 * Vận hành sửa chữa trên mobile — nguồn chính trên máy, Mac/server chỉ backup.
 */
import { loadCameraStock, loadCustomerRepairs, saveCustomerRepairs } from './mobileLocalDb';
import { computeTrueCost } from '../constants/cameraLifecycle';
import { sortRepairTickets } from '../constants/customerRepair';

const DEFECT_RE = /mốc|hỏng|kẹt|lỗi|defect|fungus|jam|shutter|leak/i;

const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function cameraHasDefect(camera) {
  if (!camera) return false;
  if (camera.has_defect) return true;
  if (Array.isArray(camera.defect_tags) && camera.defect_tags.length > 0) return true;
  if (camera.condition_grade && camera.condition_grade !== 'A') return true;
  return DEFECT_RE.test(camera.condition_note || '');
}

function buildLocalDefectRate(cameras) {
  const relevant = cameras.filter((c) => ['San_Hang', 'Cho_Sua', 'Dang_Sua', 'Da_Ban'].includes(c.status));
  const defectCount = relevant.filter((c) => cameraHasDefect(c)).length;
  const totalUnits = relevant.length;
  const ratePct = totalUnits > 0 ? Math.round((defectCount / totalUnits) * 1000) / 10 : 0;

  const samples = relevant
    .filter((c) => cameraHasDefect(c))
    .slice(0, 5)
    .map((cam) => ({
      model: cam.model_name || cam.name,
      code: cam.camera_code || cam.code,
      note: cam.condition_note,
      status: cam.status,
      defect_tags: cam.defect_tags || [],
      true_cost: computeTrueCost(cam),
    }));

  return {
    ratePct,
    defectCount,
    totalUnits,
    samples,
    note: 'Theo dữ liệu máy trên iPhone — has_defect, defect_tags, condition_grade.',
  };
}

function buildLocalCameraOps() {
  const cameras = loadCameraStock();
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const waiting = cameras.filter((c) => c.status === 'Cho_Sua');
  const inRepair = cameras.filter((c) => c.status === 'Dang_Sua');
  const repairedSold = cameras.filter((c) => c.status === 'Da_Ban' && num(c.total_repair_cost) > 0);

  const repairSpendMonth = cameras.reduce((sum, c) => {
    const updated = c.updated_at || c.updatedAt || c.created_at || c.createdAt;
    if (!updated || new Date(updated) < monthStart) return sum;
    return sum + num(c.last_repair_cost || 0);
  }, 0);

  const longWaiting = waiting
    .map((c) => {
      const created = c.created_at || c.createdAt || c.intake_at;
      const daysWaiting = created
        ? Math.ceil((now - new Date(created).getTime()) / 86400000)
        : 0;
      return {
        model_name: c.model_name || c.name,
        camera_code: c.camera_code || c.code,
        daysWaiting,
        true_cost: computeTrueCost(c),
      };
    })
    .filter((c) => c.daysWaiting >= 7)
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 8);

  const roiAfterRepair = repairedSold
    .map((c) => {
      const trueCost = computeTrueCost(c);
      const sold = num(c.sold_price);
      return {
        model: c.model_name || c.name,
        code: c.camera_code || c.code,
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

function buildLocalCustomerRepairOps() {
  const tickets = loadCustomerRepairs();
  const openStatuses = ['tiep_nhan', 'cho_khach_xac_nhan', 'dang_sua', 'cho_tra'];
  const open = tickets.filter((t) => openStatuses.includes(t.status));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthReturned = tickets.filter(
    (t) => t.status === 'da_tra' && t.returned_at && new Date(t.returned_at) >= monthStart
  );

  const counts = {
    tiep_nhan: 0,
    cho_khach_xac_nhan: 0,
    dang_sua: 0,
    cho_tra: 0,
    da_tra_month: monthReturned.length,
    revenue_month: monthReturned.reduce(
      (s, t) => s + num(t.final_amount || t.quote_amount),
      0
    ),
    cost_month: monthReturned.reduce(
      (s, t) => s + num(t.internal_parts_cost) + num(t.internal_labor_cost),
      0
    ),
  };

  for (const t of open) {
    if (counts[t.status] != null) counts[t.status] += 1;
  }
  counts.profit_month = counts.revenue_month - counts.cost_month;

  return {
    counts,
    pipeline: sortRepairTickets(open).slice(0, 12),
  };
}

/** Snapshot repair ops từ dữ liệu trên máy — luôn có, không cần Mac. */
export function buildLocalRepairOpsMarket() {
  const cameras = loadCameraStock();
  return {
    customerRepairOps: buildLocalCustomerRepairOps(),
    cameraOps: buildLocalCameraOps(),
    defectRate: buildLocalDefectRate(cameras),
    _fromDevice: true,
  };
}

/** Gộp phiếu từ server vào local (backup → máy), không ghi đè phiên bản mới hơn trên máy. */
export function mergeCustomerRepairsFromServer(serverTickets = []) {
  if (!Array.isArray(serverTickets) || serverTickets.length === 0) return;
  const local = loadCustomerRepairs();
  const byId = new Map(local.map((t) => [String(t._id || t.id), t]));

  for (const ticket of serverTickets) {
    const id = String(ticket._id || ticket.id || '');
    if (!id) continue;
    const existing = byId.get(id);
    const serverAt = new Date(ticket.updatedAt || ticket.updated_at || 0).getTime();
    const localAt = existing
      ? new Date(existing.updatedAt || existing.updated_at || 0).getTime()
      : 0;
    if (!existing || serverAt >= localAt) {
      byId.set(id, { ...existing, ...ticket, _id: id });
    }
  }

  saveCustomerRepairs([...byId.values()]);
}

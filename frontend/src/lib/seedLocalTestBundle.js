/**
 * Một lần nạp: 10 máy ảnh test + đơn bán demo (biểu đồ Dashboard).
 */
import { seedLocalTestCameras } from './seedTestCameras';
import { notifyRetailDataChanged } from './seedTestCameras';
import { seedLocalDemoRetailSales } from './seedDemoRetail';
import { invalidateLocalDashboardCharts } from './mobileDashboardBridge';

export function seedLocalTestDataBundle({ forceSales = false } = {}) {
  const cameras = seedLocalTestCameras();
  const sales = seedLocalDemoRetailSales({ force: forceSales });
  invalidateLocalDashboardCharts();
  notifyRetailDataChanged();
  return { cameras, sales };
}

export function formatTestDataSeedToast({ cameras, sales }) {
  const camPart = `máy test +${cameras.added} (sẵn bán ${cameras.ready})`;
  const salePart =
    sales.created > 0
      ? `đơn demo +${sales.created}`
      : `đơn demo đã có (${sales.total})`;
  return `Đã nạp ${camPart} · ${salePart}`;
}

import DonutChart from './DonutChart';
import GroupedBarChart from './GroupedBarChart';
import {
  CHART,
  LAB_STATUS_COLORS,
  LAB_STATUS_LABELS,
} from '../../utils/chartColors';

const STATUS_ORDER = ['received', 'processing', 'completed', 'delivered'];

function statusSlices(breakdown) {
  if (!breakdown) return [];
  return STATUS_ORDER.map((key) => ({
    key,
    label: LAB_STATUS_LABELS[key],
    value: breakdown[key] || 0,
    color: LAB_STATUS_COLORS[key],
  })).filter((s) => s.value > 0);
}

function todayPipelineSlices(films) {
  return [
    { key: 'processing', label: 'Đang tráng', value: films.processing ?? 0, color: CHART.orange },
    { key: 'ready', label: 'Sẵn trả', value: films.readyForPickup ?? 0, color: CHART.green },
    { key: 'waiting', label: 'Khách chờ', value: films.waitingPickup ?? 0, color: CHART.indigo },
    { key: 'received', label: 'Tiếp nhận', value: films.receivedToday ?? 0, color: CHART.blue },
  ].filter((s) => s.value > 0);
}

export default function LabFilmCharts({ films, monthly }) {
  const monthSlices = statusSlices(monthly?.statusBreakdown);
  const todaySlices = todayPipelineSlices(films);
  const monthTotal = monthSlices.reduce((sum, s) => sum + s.value, 0);
  const todayTotal = todaySlices.reduce((sum, s) => sum + s.value, 0);

  const flowPoints =
    monthly?.totalReceived != null || monthly?.totalDelivered != null
      ? [
          {
            key: 'month',
            label: 'Tháng',
            values: {
              received: monthly?.totalReceived ?? 0,
              delivered: monthly?.totalDelivered ?? 0,
            },
          },
        ]
      : [];

  return (
    <div className="lab-film-charts">
      <div className="lab-film-charts__donuts">
        <DonutChart
          title="Pipeline hôm nay"
          slices={todaySlices}
          centerValue={todayTotal}
          centerFormat="plain"
          centerCaption="phiếu"
          emptyText="Chưa có phiếu film hôm nay"
          className="lab-film-charts__donut"
          compact
        />
        <DonutChart
          title="Tiến độ tháng"
          slices={monthSlices}
          centerValue={monthTotal}
          centerFormat="plain"
          centerCaption="phiếu"
          emptyText="Chưa có phiếu trong tháng"
          className="lab-film-charts__donut"
          compact
        />
      </div>

      <GroupedBarChart
        title="Luồng tháng"
        subtitle="Tiếp nhận vs đã trả khách"
        points={flowPoints}
        series={[
          { key: 'received', label: 'Tiếp nhận', color: CHART.blue },
          { key: 'delivered', label: 'Đã trả', color: CHART.green },
        ]}
        emptyText="Chưa có thống kê tháng"
        className="lab-film-charts__bars apple-card"
      />
    </div>
  );
}

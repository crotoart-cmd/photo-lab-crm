const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const PERIOD_PRESETS = [
  { id: 'day', label: 'Hôm nay' },
  { id: 'yesterday', label: 'Hôm qua' },
  { id: 'week', label: '7 ngày qua' },
  { id: 'last14', label: '14 ngày qua' },
  { id: 'last30', label: '30 ngày qua' },
  { id: 'month', label: 'Tháng này' },
  { id: 'quarter', label: 'Quý này' },
  { id: 'year', label: 'Năm nay' },
  { id: 'custom', label: 'Tùy chọn…' },
];

export const DASHBOARD_PERIOD_IDS = PERIOD_PRESETS.map((p) => p.id);

/** @typedef {{ id: string, start?: string, end?: string }} PeriodSelection */

/** @param {PeriodSelection} selection */
export function resolvePeriodRange(selection = { id: 'month' }) {
  const id = selection?.id || 'month';
  const end = endOfDay();

  if (id === 'custom' && selection.start && selection.end) {
    const start = startOfDay(new Date(`${selection.start}T12:00:00`));
    const customEnd = endOfDay(new Date(`${selection.end}T12:00:00`));
    if (start <= customEnd) {
      return { start, end: customEnd, id: 'custom' };
    }
  }

  const start = startOfDay();

  switch (id) {
    case 'day':
      return { start, end, id: 'day' };
    case 'yesterday': {
      const y = startOfDay();
      y.setDate(y.getDate() - 1);
      return { start: y, end: endOfDay(y), id: 'yesterday' };
    }
    case 'week':
      start.setDate(start.getDate() - 6);
      return { start, end, id: 'week' };
    case 'last14':
      start.setDate(start.getDate() - 13);
      return { start, end, id: 'last14' };
    case 'last30':
      start.setDate(start.getDate() - 29);
      return { start, end, id: 'last30' };
    case 'quarter':
      start.setMonth(start.getMonth() - 2);
      start.setDate(1);
      return { start, end, id: 'quarter' };
    case 'year':
      start.setMonth(0);
      start.setDate(1);
      return { start, end, id: 'year' };
    case 'month':
      start.setDate(1);
      return { start, end, id: 'month' };
    default:
      start.setDate(1);
      return { start, end, id: 'month' };
  }
}

export function getChartGranularity(start, end) {
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  if (days <= 1) return 'day';
  if (days <= 31) return 'month';
  if (days <= 120) return 'quarter';
  return 'year';
}

function formatShortDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
}

/** @param {PeriodSelection} selection */
export function getPeriodLabel(selection = { id: 'month' }) {
  if (selection.id === 'custom' && selection.start && selection.end) {
    if (selection.start === selection.end) {
      return formatShortDate(selection.start);
    }
    return `${formatShortDate(selection.start)} – ${formatShortDate(selection.end)}`;
  }
  return PERIOD_PRESETS.find((p) => p.id === selection.id)?.label ?? 'Tháng này';
}

/** @param {PeriodSelection} selection */
export function toAnalyticsParams(selection = { id: 'month' }) {
  if (selection.id === 'custom' && selection.start && selection.end) {
    return { period: 'custom', start: selection.start, end: selection.end };
  }
  return { period: selection.id };
}

/** @param {PeriodSelection} selection */
export function periodCacheKey(selection = { id: 'month' }) {
  if (selection.id === 'custom' && selection.start && selection.end) {
    return `custom:${selection.start}:${selection.end}`;
  }
  return selection.id;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIsoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

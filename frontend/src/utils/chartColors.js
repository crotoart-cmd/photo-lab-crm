/**
 * Apple system colors for charts (iOS HIG palette).
 * Keep in sync with --color-* tokens in apple-design.css.
 */
export const CHART = {
  blue: '#007AFF',
  green: '#34C759',
  indigo: '#5856D6',
  orange: '#FF9500',
  teal: '#5AC8FA',
  purple: '#AF52DE',
  pink: '#FF2D55',
  red: '#FF3B30',
  yellow: '#FFCC00',
  mint: '#00C7BE',
  track: '#E5E5EA',
};

export const REVENUE_SEGMENT_COLORS = {
  body: CHART.indigo,
  lens: CHART.blue,
  film_supplies: CHART.orange,
};

export const REVENUE_SEGMENT_LABELS = {
  body: 'Máy ảnh',
  lens: 'Ống kính',
  film_supplies: 'Film & vật tư',
};

export const STOCK_SEGMENT_COLORS = {
  camera: CHART.indigo,
  film: CHART.orange,
  battery: CHART.teal,
};

export const REVENUE_SLICE_META = [
  { key: 'body', label: REVENUE_SEGMENT_LABELS.body, color: CHART.indigo },
  { key: 'lens', label: REVENUE_SEGMENT_LABELS.lens, color: CHART.blue },
  { key: 'film_supplies', label: REVENUE_SEGMENT_LABELS.film_supplies, color: CHART.orange },
];

export const LAB_STATUS_COLORS = {
  received: CHART.blue,
  processing: CHART.orange,
  completed: CHART.teal,
  delivered: CHART.green,
};

export const LAB_STATUS_LABELS = {
  received: 'Tiếp nhận',
  processing: 'Đang tráng',
  completed: 'Hoàn thành',
  delivered: 'Đã trả',
};

export const CUSTOMER_SEGMENT_COLORS = {
  newbie: CHART.orange,
  pro: CHART.indigo,
  repeat: CHART.green,
  oneTime: CHART.teal,
};

/** Rút gọn nhãn tháng: 2026-06 → T6 */
export function formatChartMonth(key) {
  if (!key) return '';
  const parts = String(key).split('-');
  if (parts.length < 2) return key;
  return `T${Number(parts[1])}`;
}

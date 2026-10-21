export const SCAN_METHODS = [
  { value: 'hiend', hintKey: 'opt.scan.hiendHint' },
  { value: 'batch', hintKey: 'opt.scan.batchHint' },
];

export const SCAN_SOURCES = ['negative', 'lab_roll'];
export const SCAN_FORMATS = ['35mm', '120', 'other'];
export const SCAN_SIZES = ['s', 'm', 'l'];
export const SCAN_OUTPUTS = ['jpeg', 'tiff', 'both'];
export const SCAN_DELIVERY = ['pickup', 'ship'];

export const emptyScanOrder = {
  method: 'batch',
  source: 'negative',
  format: '35mm',
  scanSize: 'm',
  output: 'jpeg',
  quantity: 1,
  ticketRef: '',
  delivery: 'pickup',
  address: '',
  note: '',
};

export function applyScanMethod(order, method) {
  const next = { ...order, method };
  if (method === 'hiend') {
    next.scanSize = 'hiend';
    if (next.output === 'jpeg') next.output = 'tiff';
  } else if (next.scanSize === 'hiend') {
    next.scanSize = 'm';
    if (next.output === 'tiff') next.output = 'jpeg';
  }
  return next;
}

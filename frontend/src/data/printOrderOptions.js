export const PRINT_METHODS = [
  { value: 'optical', hintKey: 'opt.print.opticalHint' },
  { value: 'inkjet', hintKey: 'opt.print.inkjetHint' },
];

export const PRINT_SOURCES = {
  optical: ['negative', 'lab_scan'],
  inkjet: ['files', 'lab_scan'],
};

export const PRINT_SIZES = ['10x15', '13x18', '20x30', '30x40', '40x60', 'max', 'custom'];

export const PRINT_PAPERS = {
  optical: ['ilford', 'fuji'],
  inkjet: ['glossy', 'matte'],
};

export const PRINT_FILE_HANDOFF = ['link', 'usb', 'later'];

export const PRINT_DELIVERY = ['pickup', 'ship'];

export const emptyPrintOrder = {
  method: 'optical',
  source: 'negative',
  size: '13x18',
  customSize: '',
  paper: 'ilford',
  quantity: 1,
  fileHandoff: 'link',
  fileLink: '',
  delivery: 'pickup',
  address: '',
  note: '',
};

export function applyPrintMethod(order, method) {
  const next = { ...order, method };
  const sources = PRINT_SOURCES[method];
  const papers = PRINT_PAPERS[method];
  if (!sources.includes(next.source)) next.source = sources[0];
  if (!papers.includes(next.paper)) next.paper = papers[0];
  if (next.source !== 'files') {
    next.fileHandoff = 'link';
    next.fileLink = '';
  }
  return next;
}

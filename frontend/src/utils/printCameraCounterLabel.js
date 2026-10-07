import { BRAND_NAME } from '../config/brand';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * In tem dán máy — mã quầy, tên máy, số sê-ri (58×40mm, phù hợp máy in nhiệt).
 */
export function printCameraCounterLabel({
  cameraCode,
  brand = '',
  modelName = '',
  serialNumber = '',
}) {
  const code = String(cameraCode || '').trim();
  if (!code) return false;

  const machine = [brand, modelName].filter(Boolean).join(' ').trim() || '—';
  const serial = String(serialNumber || '').trim() || 'Chưa có sê-ri';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Tem ${escapeHtml(code)}</title>
  <style>
    @page { size: 58mm 40mm; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 3mm 3.5mm;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label {
      width: 52mm;
      min-height: 34mm;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
    }
    .brand {
      font-size: 7pt;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #666;
      text-transform: uppercase;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1.1;
      word-break: break-all;
    }
    .code-caption {
      font-size: 6.5pt;
      font-weight: 600;
      color: #0070ff;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .row {
      font-size: 7.5pt;
      line-height: 1.25;
    }
    .row-label {
      color: #666;
      font-weight: 500;
    }
    .row-value {
      font-weight: 600;
    }
    .serial {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 7pt;
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="brand">${escapeHtml(BRAND_NAME)}</div>
    <div class="code-caption">Mã quầy</div>
    <div class="code">${escapeHtml(code)}</div>
    <div class="row"><span class="row-label">Máy: </span><span class="row-value">${escapeHtml(machine)}</span></div>
    <div class="row"><span class="row-label">Sê-ri: </span><span class="row-value serial">${escapeHtml(serial)}</span></div>
  </div>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const wwwDir = path.join(__dirname, '..', 'www');
const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBin)) {
  console.error('Chưa có frontend/node_modules — chạy: cd frontend && npm install');
  process.exit(1);
}

const node = process.execPath;
const lanIp =
  process.env.VITE_API_URL ||
  (() => {
    try {
      const { execSync } = require('child_process');
      const ip = execSync('ipconfig getifaddr en0 || ipconfig getifaddr en1', {
        encoding: 'utf8',
      }).trim();
      if (ip) return `http://${ip}:5001/api`;
    } catch {
      /* ignore */
    }
    return 'http://localhost:5001/api';
  })();

const buildEnv = { ...process.env };
delete buildEnv.VITE_DEVICE_SMTP_EMAIL;
delete buildEnv.VITE_DEVICE_SMTP_PASSWORD;

const result = spawnSync(
  node,
  [viteBin, 'build', '--base', './', '--outDir', wwwDir, '--emptyOutDir'],
  {
    cwd: frontendDir,
    stdio: 'inherit',
    env: {
      ...buildEnv,
      ELECTRON_RUN_AS_NODE: '1',
      VITE_MOBILE_APP: 'true',
      VITE_API_URL: process.env.VITE_API_URL || lanIp,
    },
  }
);

if (result.status !== 0) process.exit(result.status ?? 1);

// Capacitor Android WebView:
// 1) crossorigin trên module → CORS fail
// 2) stylesheet Google Fonts đồng bộ → máy PRC/offline treo parse → JS không chạy → màn trắng
const indexHtml = path.join(wwwDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  let html = fs.readFileSync(indexHtml, 'utf8');
  const before = html;
  html = html
    .replace(/\s+crossorigin(?:="[^"]*")?/gi, '')
    .replace(/\s+crossorigin(?:='[^']*')?/gi, '');
  // Bỏ hẳn Google Fonts / Material Symbols CDN khỏi bản native (dùng SF/system + icon SVG).
  html = html.replace(
    /<link[^>]+fonts\.googleapis\.com[^>]*>\s*/gi,
    ''
  );
  html = html.replace(/<link[^>]+fonts\.gstatic\.com[^>]*>\s*/gi, '');
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/gi, '');
  if (html !== before) {
    fs.writeFileSync(indexHtml, html, 'utf8');
    console.log('🔧 index.html: gỡ crossorigin + Google Fonts (fix WebView Android)');
  }
}

console.log('✅ www/ sẵn sàng cho mobile (iOS/Android):', wwwDir);
console.log('   API mặc định:', process.env.VITE_API_URL || lanIp);

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const projectRoot = path.join(root, '..');
const staging = path.join(root, 'staging');
const backendSrc = path.join(projectRoot, 'backend');
const backendDst = path.join(staging, 'backend');
const frontendDst = path.join(staging, 'frontend');

const IGNORE = new Set(['node_modules', 'uploads', 'backups', '.env', 'credentials.json']);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (IGNORE.has(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dst, name);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

const dist = path.join(projectRoot, 'frontend', 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('Thiếu frontend/dist — chạy: npm run build:frontend');
  process.exit(1);
}

copyDir(backendSrc, backendDst);
fs.cpSync(dist, frontendDst, { recursive: true });

console.log('📦 Staging backend + frontend...');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npm, ['ci', '--omit=dev'], {
  cwd: backendDst,
  stdio: 'inherit',
});
if (install.status !== 0) {
  console.error('npm ci trong staging/backend thất bại');
  process.exit(install.status ?? 1);
}

console.log('✅ Staging xong:', staging);

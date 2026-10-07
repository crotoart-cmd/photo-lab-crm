const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const macosAppDir = path.join(__dirname, '..');
const frontendDist = path.join(macosAppDir, '..', 'frontend', 'dist', 'index.html');

if (!fs.existsSync(frontendDist)) {
  console.log('→ Build frontend lần đầu...');
  const build = spawnSync('npm', ['run', 'build:frontend'], {
    cwd: macosAppDir,
    stdio: 'inherit',
    shell: true,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const electron = path.join(macosAppDir, 'node_modules', 'electron', 'cli.js');
if (!fs.existsSync(electron)) {
  console.error('Chưa cài macos-app deps — chạy: cd macos-app && npm install');
  process.exit(1);
}

spawnSync(process.execPath, [electron, '.'], {
  cwd: macosAppDir,
  stdio: 'inherit',
  env: process.env,
});

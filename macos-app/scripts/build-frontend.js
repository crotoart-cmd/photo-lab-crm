const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBin)) {
  console.error('Chưa có frontend/node_modules — chạy: cd frontend && npm install');
  process.exit(1);
}

const node = process.execPath;
const result = spawnSync(node, [viteBin, 'build', '--base', './'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

process.exit(result.status ?? 1);

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function buildMode(backendDir) {
  if (fs.existsSync(path.join(backendDir, '../frontend/package.json'))) return 'source';
  const index = path.join(backendDir, 'public/index.html');
  const assets = path.join(backendDir, 'public/assets');
  if (fs.statSync(index, { throwIfNoEntry: false })?.isFile()
    && fs.statSync(assets, { throwIfNoEntry: false })?.isDirectory()) return 'prebuilt';
  throw new Error('Frontend source and compiled public assets are both missing. Redeploy from GitHub, not a backend-only archive.');
}

if (require.main === module) {
  const backendDir = path.resolve(__dirname, '..');
  try {
    if (buildMode(backendDir) === 'prebuilt') {
      console.log('Keeping compiled public assets for this environment-only redeployment.');
    } else {
      const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:web'], {
        cwd: backendDir,
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildMode };

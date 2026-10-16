const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function loadDesktopSecurity(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, 'desktop-security.json');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!/^[a-f0-9]{96}$/.test(config.jwtSecret || '') ||
        typeof config.ownerPassword !== 'string' || config.ownerPassword.length < 16) {
      throw new Error('Cấu hình bảo mật desktop không hợp lệ');
    }
    fs.chmodSync(filename, 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    config = {
      jwtSecret: crypto.randomBytes(48).toString('hex'),
      ownerPassword: crypto.randomBytes(24).toString('base64url'),
    };
    fs.writeFileSync(filename, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
  }
  return config;
}

module.exports = { loadDesktopSecurity };

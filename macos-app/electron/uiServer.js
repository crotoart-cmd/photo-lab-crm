const path = require('node:path');
const express = require('express');
const httpProxy = require('http-proxy');

function createUiApp(frontendDir, backendUrl) {
  const ui = express();
  const proxy = httpProxy.createProxyServer({ target: backendUrl, changeOrigin: true });
  ui.disable('x-powered-by');
  ui.use((req, res, next) => {
    if (['/api', '/uploads'].some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
      return proxy.web(req, res, {}, () => {
        if (res.headersSent) return res.destroy();
        return res.status(502).json({ message: 'Không kết nối được máy chủ' });
      });
    }
    return next();
  });
  ui.use(express.static(frontendDir));
  ui.get('*', (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
  return ui;
}

module.exports = { createUiApp };

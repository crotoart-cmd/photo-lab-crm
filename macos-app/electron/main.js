const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const BACKEND_PORT = 59101;
const UI_PORT = 59102;

let backendProcess = null;
let uiServer = null;
let mainWindow = null;

const projectRoot = path.join(__dirname, '..', '..');
const isPackaged = app.isPackaged;

function getPaths() {
  if (isPackaged) {
    return {
      backendDir: path.join(process.resourcesPath, 'backend'),
      frontendDir: path.join(process.resourcesPath, 'frontend'),
    };
  }
  return {
    backendDir: path.join(projectRoot, 'backend'),
    frontendDir: path.join(projectRoot, 'frontend', 'dist'),
  };
}

function waitForHealth(port, attempts = 60) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      left -= 1;
      if (left <= 0) reject(new Error('Backend không khởi động được'));
      else setTimeout(tick, 500);
    };
    tick();
  });
}

function startBackend(backendDir) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(backendDir, 'server.js');
    backendProcess = spawn(process.execPath, [serverPath], {
      cwd: backendDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        USE_MEMORY_DB: 'true',
        PORT: String(BACKEND_PORT),
        NODE_ENV: 'production',
        FRONTEND_URL: `http://127.0.0.1:${UI_PORT}`,
      },
      stdio: isPackaged ? 'ignore' : 'inherit',
    });

    backendProcess.on('error', reject);
    backendProcess.on('exit', (code) => {
      if (code && code !== 0 && mainWindow) {
        console.error('Backend exited', code);
      }
    });

    waitForHealth(BACKEND_PORT).then(resolve).catch(reject);
  });
}

function startUiServer(frontendDir) {
  return new Promise((resolve, reject) => {
    const ui = express();
    ui.use(
      '/api',
      createProxyMiddleware({
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
      })
    );
    ui.use(
      '/uploads',
      createProxyMiddleware({
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
      })
    );
    ui.use(express.static(frontendDir));
    ui.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDir, 'index.html'));
    });

    uiServer = ui.listen(UI_PORT, '127.0.0.1', () => resolve());
    uiServer.on('error', reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: 'HDTLabx',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${UI_PORT}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function shutdown() {
  if (uiServer) {
    uiServer.close();
    uiServer = null;
  }
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  const { backendDir, frontendDir } = getPaths();
  try {
    await startBackend(backendDir);
    await startUiServer(frontendDir);
    createWindow();
  } catch (err) {
    console.error(err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  shutdown();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', shutdown);

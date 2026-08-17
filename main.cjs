const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const WEB_PORT = Number(process.env.T_ASTRO_PORT || 6002);
const SOLVER_PORT = Number(process.env.T_ASTRO_SOLVER_PORT || 6001);
let mainWindow = null;
let serverProcess = null;
let solverProcess = null;

function appRoot() {
  return app.isPackaged ? app.getAppPath() : __dirname;
}

function resourcePath(...parts) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...parts)
    : path.join(appRoot(), ...parts);
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`ポート ${port} が ${timeoutMs / 1000} 秒以内に起動しませんでした。`));
        else setTimeout(check, 250);
      });
    };
    check();
  });
}

function loadUrlWithRetry(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      mainWindow.loadURL(url).then(resolve).catch((error) => {
        if (Date.now() - started > timeoutMs) reject(error);
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function startNodeServer() {
  const script = resourcePath('server.cjs');
  if (!fs.existsSync(script)) throw new Error(`server.cjs が見つかりません: ${script}`);
  const nodeExecutable = process.platform === 'win32' ? process.execPath : process.execPath;
  serverProcess = spawn(nodeExecutable, [script, '--port', String(WEB_PORT), '--host', '127.0.0.1'], {
    cwd: appRoot(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production', PORT: String(WEB_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', data => console.log(`[server] ${data}`));
  serverProcess.stderr.on('data', data => console.error(`[server] ${data}`));
  serverProcess.on('error', error => console.error('[server] 起動エラー', error));
  serverProcess.on('exit', (code, signal) => console.log(`[server] 終了 code=${code} signal=${signal}`));
}

function findPython() {
  return process.platform === 'win32' ? 'python.exe' : 'python3';
}

function startSolverIfAvailable() {
  if (process.env.T_ASTRO_AUTOSTART_SOLVER === '0') return;
  if (process.platform === 'win32' && process.env.T_ASTRO_SOLVER_PYTHON) {
    // 明示指定された Python ランチャーを優先する。
  }
  const script = app.isPackaged ? resourcePath('solver', 'solver_server.py') : path.join(appRoot(), 'solver_server.py');
  if (!fs.existsSync(script)) return;
  const python = process.env.T_ASTRO_SOLVER_PYTHON || findPython();
  solverProcess = spawn(python, [script], {
    cwd: path.dirname(script),
    env: { ...process.env, PORT: String(SOLVER_PORT), SOLVER_PORT: String(SOLVER_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  solverProcess.stdout.on('data', data => console.log(`[solver] ${data}`));
  solverProcess.stderr.on('data', data => console.error(`[solver] ${data}`));
  solverProcess.on('error', error => console.error('[solver] 起動できません。Python と依存パッケージを確認してください。', error));
}

function showStartupError(error) {
  const detail = error && error.stack ? error.stack : String(error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="font-family:Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px"><h2 style="color:#f87171">T-Astro Web Studio を起動できません</h2><p>ローカル Web サーバーまたは必要なサービスが起動していません。</p><pre style="white-space:pre-wrap;background:#020617;padding:16px;border-radius:8px">${detail.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre><p>ポート ${WEB_PORT}、SolverAPI ポート ${SOLVER_PORT}、Python／ドライバの状態を確認してください。</p></body></html>`)}`);
  } else {
    dialog.showErrorBox('T-Astro Web Studio', detail);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => console.error(`[renderer] did-fail-load ${code}: ${description}`));
  try {
    await waitForPort(WEB_PORT);
    await loadUrlWithRetry(`http://127.0.0.1:${WEB_PORT}/`);
  } catch (error) {
    console.error('[electron] 起動失敗', error);
    showStartupError(error);
  }
}

async function shutdown() {
  for (const child of [solverProcess, serverProcess]) {
    if (child && !child.killed) child.kill();
  }
  solverProcess = null;
  serverProcess = null;
}

app.whenReady().then(async () => {
  process.chdir(appRoot());
  startNodeServer();
  startSolverIfAvailable();
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(showStartupError);

app.on('before-quit', shutdown);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, Notification, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

// electron-updater is optional at install-time. If `electron-updater` isn't
// installed yet (e.g. `npm install` not run), keep the app working anyway.
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; }
catch (e) { console.warn('[walkers] electron-updater not available — auto-update disabled.'); }

// Sentry (processo principal) — opcional. Captura crashes do Electron.
// Inerte sem SENTRY_DSN ou sem o pacote instalado (`npm i @sentry/electron`).
try {
  if (process.env.SENTRY_DSN) {
    require('@sentry/electron/main').init({ dsn: process.env.SENTRY_DSN });
  }
} catch (e) { console.warn('[walkers] @sentry/electron not available — main-process monitoring disabled.'); }

// ─── Local static server (renderer runs on http://localhost:PORT so Firebase Auth works) ───
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

function startLocalServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        const resolved = path.normalize(path.join(rootDir, urlPath));
        if (!resolved.startsWith(rootDir)) { res.writeHead(403); res.end('Forbidden'); return; }
        let stat;
        try { stat = fs.statSync(resolved); } catch { stat = null; }
        let filePath = resolved;
        if (!stat || stat.isDirectory()) {
          const fallback = path.join(rootDir, 'index.html');
          if (fs.existsSync(fallback)) filePath = fallback;
          else { res.writeHead(404); res.end('Not found'); return; }
        }
        const ext = path.extname(filePath).toLowerCase();
        const type = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        fs.createReadStream(filePath).pipe(res);
      } catch (e) {
        res.writeHead(500); res.end('Server error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = (addr && typeof addr === 'object') ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

const DATA_DIR = path.join(os.homedir(), '.walkers-kanban');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const NOTIF_FILE = path.join(DATA_DIR, 'notifications.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
// Stores the current user's Firebase ID token + refresh token so the MCP server
// (running as a separate Node process for Claude Desktop) can read/write the
// same Firestore doc the app uses.
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
// Persistent Google OAuth tokens (Calendar + Gmail) — uses refresh_token flow so
// the app can renew access tokens silently for ~6 months without re-prompting.
const GOOGLE_OAUTH_FILE = path.join(DATA_DIR, 'google-oauth.bin');     // encrypted refresh_token blob
const GOOGLE_OAUTH_CLIENT_FILE = path.join(DATA_DIR, 'google-oauth-client.json'); // { clientId }

const DEFAULT_DATA = {
  version: 3,
  cols: [
    { id: 'c1', name: 'A Iniciar', color: '#3b82f6' },
    { id: 'c2', name: 'Em Implementação', color: '#a855f7' },
    { id: 'c3', name: 'Aguardando Cliente', color: '#f59e0b' },
    { id: 'c4', name: 'Concluído', color: '#22c55e' }
  ],
  cards: [],
  members: [],
  tags: []
};

const DEFAULT_SETTINGS = {
  minimizeToTray: true,
  autoLaunch: false,
  notifications: true
};

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  if (!fs.existsSync(NOTIF_FILE)) fs.writeFileSync(NOTIF_FILE, JSON.stringify([], null, 2));
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

function loadData() {
  ensureFiles();
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (!d.version) d.version = 3;
    if (!d.members) d.members = [];
    if (!d.tags) d.tags = [];
    (d.cards || []).forEach(c => {
      if (c.desc === undefined) c.desc = '';
      if (c.subtasks === undefined) c.subtasks = [];
      if (c.due === undefined) c.due = null;
      if (c.tagIds === undefined) c.tagIds = [];
      if (c.assignee === undefined) c.assignee = null;
      if (c.attachments === undefined) c.attachments = [];
      if (c.comments === undefined) c.comments = [];
    });
    return d;
  } catch (e) {
    return { ...DEFAULT_DATA };
  }
}

function loadNotifications() {
  ensureFiles();
  try { return JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf-8')); }
  catch { return []; }
}

function loadSettings() {
  ensureFiles();
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

let lastInternalSave = 0;
function saveData(data) {
  ensureFiles();
  lastInternalSave = Date.now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function saveNotifications(notifs) {
  ensureFiles();
  fs.writeFileSync(NOTIF_FILE, JSON.stringify(notifs, null, 2));
}
function saveSettings(s) {
  ensureFiles();
  const merged = { ...loadSettings(), ...s };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

function saveAuth(payload) {
  ensureFiles();
  if (!payload) {
    try { fs.unlinkSync(AUTH_FILE); } catch {}
    return;
  }
  // 0600-ish permission attempt (Windows still has it but Node ignores chmod)
  fs.writeFileSync(AUTH_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

// Single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;
let tray = null;
let watcher = null;
let watchDebounce = null;
let localServer = null;
let localServerPort = 0;
let isQuitting = false;
// Set briefly by the renderer before triggering a silent Google reauth — the next
// auth popup will open hidden (show:false) so the user doesn't see anything.
let nextPopupSilent = false;
let nextPopupSilentTimer = null;

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon-192.png');
  let image = nativeImage.createFromPath(iconPath);
  if (process.platform !== 'win32') image = image.resize({ width: 18, height: 18 });
  tray = new Tray(image);
  tray.setToolTip('Walkers Kanban');
  const ctx = Menu.buildFromTemplate([
    { label: 'Abrir Walkers', click: showWindow },
    { type: 'separator' },
    { label: 'Verificar atualizações', click: () => triggerUpdateCheck(true) },
    { type: 'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(ctx);
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

function createWindow() {
  ensureFiles();
  mainWindow = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1000, minHeight: 640,
    backgroundColor: '#0d0e11',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon-512.png'),
    title: 'Walkers Kanban', autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'), sandbox: true
    },
    show: false
  });

  Menu.setApplicationMenu(null);

  // Dev: load from Vite dev server. Prod: load from local HTTP server (NOT file://),
  // because Firebase Auth's Google sign-in rejects file:// origins.
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    // Entry do app agora é app.html (a raiz do site é a landing estática)
    mainWindow.loadURL('http://localhost:5173/app.html');
  } else {
    const distDir = path.join(__dirname, 'dist');
    const distIndex = path.join(distDir, 'app.html');
    const useDist = fs.existsSync(distIndex);
    const serveRoot = useDist ? distDir : __dirname;
    startLocalServer(serveRoot)
      .then(({ server, port }) => {
        localServer = server;
        localServerPort = port;
        const url = `http://localhost:${port}/app.html`;
        console.log('[walkers] Local server:', url, 'serving', serveRoot);
        mainWindow.loadURL(url);
      })
      .catch(err => {
        console.error('[walkers] Local server failed to start, falling back to file://', err);
        if (useDist) mainWindow.loadFile(distIndex);
        else mainWindow.loadFile('app.html');
      });
  }
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const authHosts = ['accounts.google.com', 'walkerskambam.firebaseapp.com', 'apis.google.com'];
    try {
      const u = new URL(url);
      if (authHosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) {
        // If renderer flagged this as a silent auto-renewal, open hidden so user sees nothing.
        const silent = nextPopupSilent;
        if (silent) {
          nextPopupSilent = false;
          if (nextPopupSilentTimer) { clearTimeout(nextPopupSilentTimer); nextPopupSilentTimer = null; }
        }
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500, height: 680,
            modal: !silent, parent: silent ? undefined : mainWindow,
            show: !silent, skipTaskbar: silent,
            autoHideMenuBar: true,
            webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
          }
        };
      }
    } catch {}
    shell.openExternal(url); return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return;
    if (url.startsWith('http://localhost:5173')) return;
    if (localServerPort && (url.startsWith(`http://127.0.0.1:${localServerPort}`) || url.startsWith(`http://localhost:${localServerPort}`))) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  try {
    watcher = fs.watch(DATA_FILE, () => {
      if (Date.now() - lastInternalSave < 200) return;
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('data-changed-externally');
        }
      }, 120);
    });
  } catch (e) { console.warn('Watcher unavailable:', e); }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Minimize to tray instead of closing — unless the user explicitly chose Quit.
  mainWindow.on('close', (e) => {
    const settings = loadSettings();
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
      if (process.platform === 'win32' && tray && !mainWindow._trayHintShown) {
        mainWindow._trayHintShown = true;
        try {
          tray.displayBalloon({
            iconType: 'info',
            title: 'Walkers Kanban',
            content: 'O app continua rodando na bandeja. Clique no ícone pra abrir de novo.'
          });
        } catch {}
      }
    }
  });

  mainWindow.on('closed', () => {
    if (watcher) watcher.close();
    if (localServer) { try { localServer.close(); } catch {} localServer = null; }
    mainWindow = null;
  });
}

// ─── Google OAuth Desktop Flow (PKCE + loopback + refresh_token) ──────
// Gives a refresh_token that lasts ~6 months without use, mean transparent
// access_token refresh forever. Way better than Firebase signInWithPopup
// (which only gives a 1h access_token with no refresh).
// Gmail DESATIVADO (scope restrito → exige avaliação CASA). Só Calendar por ora.
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly'
  // 'https://www.googleapis.com/auth/gmail.readonly'
].join(' ');

function saveEncrypted(filePath, data) {
  ensureFiles();
  if (safeStorage.isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(data);
    fs.writeFileSync(filePath, buf);
  } else {
    // Fallback: plain JSON. OS-level keychain not available (rare in Electron 13+).
    fs.writeFileSync(filePath, data);
  }
}

function readEncrypted(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  if (safeStorage.isEncryptionAvailable()) {
    try { return safeStorage.decryptString(buf); } catch { return null; }
  }
  return buf.toString();
}

function loadGoogleOAuthState() {
  const tokenBlob = readEncrypted(GOOGLE_OAUTH_FILE);
  const clientInfo = fs.existsSync(GOOGLE_OAUTH_CLIENT_FILE)
    ? JSON.parse(fs.readFileSync(GOOGLE_OAUTH_CLIENT_FILE, 'utf-8'))
    : null;
  if (!tokenBlob || !clientInfo?.clientId) return null;
  try {
    return { ...JSON.parse(tokenBlob), clientId: clientInfo.clientId, clientSecret: clientInfo.clientSecret || null };
  } catch { return null; }
}

function clearGoogleOAuthState() {
  try { fs.unlinkSync(GOOGLE_OAUTH_FILE); } catch {}
  try { fs.unlinkSync(GOOGLE_OAUTH_CLIENT_FILE); } catch {}
}

function pkceVerifier() {
  return crypto.randomBytes(32).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function pkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

let currentOAuthServer = null;
let currentOAuthReject = null;

function googleOAuthStart(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    if (!clientId || !/^\d+-[\w]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
      return reject(new Error('Client ID inválido — deve ter formato "XXXX-YYYY.apps.googleusercontent.com"'));
    }
    // Cancel any prior pending OAuth
    if (currentOAuthServer) { try { currentOAuthServer.close(); } catch {} }
    if (currentOAuthReject) currentOAuthReject(new Error('Cancelado por nova tentativa'));
    currentOAuthReject = reject;
    const verifier = pkceVerifier();
    const challenge = pkceChallenge(verifier);
    let port = 0;
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url || '/', `http://localhost:${port}`);
        if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
        const code = u.searchParams.get('code');
        const errParam = u.searchParams.get('error');
        // Always respond with a friendly page
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (errParam) {
          res.end(`<html><body style="background:#0d0e11;color:#e8eaf0;font-family:sans-serif;text-align:center;padding-top:80px;"><h1>❌ Autorização cancelada</h1><p>${errParam}</p><p>Pode fechar esta aba.</p></body></html>`);
          server.close();
          return reject(new Error('Usuário cancelou: ' + errParam));
        }
        if (!code) {
          res.end('<html><body>Sem code recebido</body></html>');
          server.close();
          return reject(new Error('Sem authorization code'));
        }
        res.end(`<html><body style="background:#0d0e11;color:#e8eaf0;font-family:sans-serif;text-align:center;padding-top:80px;"><h1 style="background:linear-gradient(135deg,#7c5cfc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:48px;">✓ Conectado!</h1><p>Pode fechar esta aba e voltar pro Walkers Kanban.</p></body></html>`);
        // Exchange code for tokens
        const redirectUri = `http://localhost:${port}/callback`;
        const exchangeParams = {
          client_id: clientId,
          code,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        };
        // Web app clients require client_secret; Desktop App clients use PKCE alone.
        if (clientSecret) exchangeParams.client_secret = clientSecret;
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(exchangeParams)
        });
        server.close();
        if (!tokenRes.ok) {
          const text = await tokenRes.text().catch(() => '');
          // Friendly diagnostics for common errors
          if (/client_secret is missing/i.test(text)) {
            return reject(new Error(
              'Esse Client ID é do tipo "Web Application" (precisa de Client Secret). ' +
              'Recomendado: crie um NOVO OAuth Client tipo "Aplicativo para computador (Desktop app)" — não precisa de secret. ' +
              'Alternativa: cole também o Client Secret abaixo do Client ID.'
            ));
          }
          if (/redirect_uri_mismatch/i.test(text)) {
            return reject(new Error(
              'redirect_uri_mismatch: o Client ID que você criou não permite localhost. ' +
              'Recrie como tipo "Aplicativo para computador (Desktop app)" — ele aceita localhost automaticamente.'
            ));
          }
          if (/invalid_grant/i.test(text)) {
            return reject(new Error('Authorization code expirou ou foi reutilizado. Tente conectar de novo.'));
          }
          return reject(new Error(`Token exchange falhou (${tokenRes.status}): ${text.slice(0, 250)}`));
        }
        const tokens = await tokenRes.json();
        if (!tokens.refresh_token) {
          return reject(new Error('Não recebeu refresh_token. Garanta que prompt=consent foi usado e que esse Client ID é tipo "Desktop App".'));
        }
        // Persist refresh_token (encrypted) + client_id/secret (plain — secret needed for future refreshes if web type)
        saveEncrypted(GOOGLE_OAUTH_FILE, JSON.stringify({
          refresh_token: tokens.refresh_token,
          scope: tokens.scope || GOOGLE_SCOPES,
          saved_at: Date.now()
        }));
        fs.writeFileSync(GOOGLE_OAUTH_CLIENT_FILE, JSON.stringify({ clientId, clientSecret: clientSecret || null }));
        resolve({
          access_token: tokens.access_token,
          expires_in: tokens.expires_in || 3600,
          scope: tokens.scope
        });
      } catch (e) {
        try { server.close(); } catch {}
        reject(e);
      }
    });
    server.on('error', reject);
    currentOAuthServer = server;
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      port = (addr && typeof addr === 'object') ? addr.port : 0;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://localhost:${port}/callback`,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: challenge,
        code_challenge_method: 'S256'
      });
      console.log('[walkers] OAuth URL:', authUrl);
      console.log('[walkers] Listening callback on:', `http://localhost:${port}/callback`);
      // Send URL to renderer so the UI can show "copiar URL" fallback
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('google-oauth-url', authUrl));
      // Open in user's default browser
      shell.openExternal(authUrl).catch(err => {
        console.error('[walkers] Failed to open browser:', err);
      });
    });
    // 5-min safety timeout
    setTimeout(() => {
      if (currentOAuthServer === server) {
        try { server.close(); } catch {}
        currentOAuthServer = null;
        currentOAuthReject = null;
        reject(new Error('Tempo esgotado — você não autorizou em 5 minutos. Veja se passou da tela "App não verificado".'));
      }
    }, 5 * 60 * 1000);
  });
}

function googleOAuthCancel() {
  if (currentOAuthServer) { try { currentOAuthServer.close(); } catch {} currentOAuthServer = null; }
  if (currentOAuthReject) { currentOAuthReject(new Error('Cancelado pelo usuário')); currentOAuthReject = null; }
}

async function googleOAuthRefresh() {
  const state = loadGoogleOAuthState();
  if (!state) throw new Error('Sem refresh_token salvo. Conecte primeiro.');
  const params = {
    client_id: state.clientId,
    refresh_token: state.refresh_token,
    grant_type: 'refresh_token'
  };
  if (state.clientSecret) params.client_secret = state.clientSecret;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // If refresh_token is invalid/revoked, clear local state
    if (res.status === 400 || res.status === 401) clearGoogleOAuthState();
    throw new Error(`Refresh falhou (${res.status}): ${text.slice(0, 250)}`);
  }
  const tokens = await res.json();
  return {
    access_token: tokens.access_token,
    expires_in: tokens.expires_in || 3600,
    scope: tokens.scope
  };
}

// ─── Auto-launch ──────────────────────────────────────────────────────
function applyAutoLaunch(enabled) {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      // Start minimized to tray so user isn't ambushed by the app every boot
      openAsHidden: true,
      args: ['--hidden']
    });
  }
}

// ─── Auto-update ──────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-status', { kind: 'available', version: info.version });
    }
  });
  autoUpdater.on('update-not-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-status', { kind: 'none' });
    }
  });
  autoUpdater.on('download-progress', (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-status', { kind: 'progress', percent: Math.round(p.percent || 0) });
    }
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-status', { kind: 'downloaded', version: info.version });
    }
  });
  autoUpdater.on('error', (err) => {
    console.warn('[walkers] updater error:', err && err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-status', { kind: 'error', message: String(err && err.message || err) });
    }
  });
}

function triggerUpdateCheck(notifyResult = false) {
  if (!autoUpdater) {
    if (notifyResult && mainWindow) {
      mainWindow.webContents.send('updater-status', { kind: 'unavailable' });
    }
    return;
  }
  try {
    autoUpdater.checkForUpdates().catch(err => console.warn('[walkers] checkForUpdates:', err.message));
  } catch (e) { console.warn('[walkers] updater not configured:', e.message); }
}

// ─── IPC ──────────────────────────────────────────────────────────────
ipcMain.handle('load-data', () => loadData());
ipcMain.handle('save-data', (_e, data) => { saveData(data); return true; });
ipcMain.handle('load-notifications', () => loadNotifications());
ipcMain.handle('save-notifications', (_e, notifs) => { saveNotifications(notifs); return true; });
ipcMain.handle('get-data-path', () => DATA_FILE);
ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));
ipcMain.handle('show-data-folder', () => shell.openPath(DATA_DIR));

ipcMain.handle('save-auth', (_e, payload) => { saveAuth(payload); return true; });

// Google OAuth Desktop Flow (refresh_token mode)
ipcMain.handle('google-oauth-start', async (_e, clientId, clientSecret) => {
  return await googleOAuthStart(clientId, clientSecret);
});
ipcMain.handle('google-oauth-refresh', async () => {
  return await googleOAuthRefresh();
});
ipcMain.handle('google-oauth-cancel', () => {
  googleOAuthCancel();
  return true;
});
// Renderer asks to make the next auth popup invisible (for silent token refresh)
ipcMain.handle('set-next-popup-silent', (_e, silent) => {
  nextPopupSilent = !!silent;
  if (nextPopupSilentTimer) clearTimeout(nextPopupSilentTimer);
  if (nextPopupSilent) {
    nextPopupSilentTimer = setTimeout(() => { nextPopupSilent = false; nextPopupSilentTimer = null; }, 15_000);
  }
  return true;
});
ipcMain.handle('google-oauth-clear', () => {
  clearGoogleOAuthState();
  return true;
});
ipcMain.handle('google-oauth-status', () => {
  const state = loadGoogleOAuthState();
  return {
    hasRefreshToken: !!state,
    clientId: state?.clientId || null,
    savedAt: state?.saved_at || null
  };
});
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_e, patch) => {
  const merged = saveSettings(patch || {});
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'autoLaunch')) {
    applyAutoLaunch(merged.autoLaunch);
  }
  return merged;
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-for-updates', () => { triggerUpdateCheck(true); return true; });
ipcMain.handle('install-update', () => {
  if (autoUpdater) {
    isQuitting = true;
    autoUpdater.quitAndInstall();
  }
});
ipcMain.handle('quit-app', () => { isQuitting = true; app.quit(); });

ipcMain.handle('show-notification', (_e, { title, body }) => {
  const settings = loadSettings();
  if (!settings.notifications) return false;
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title: title || 'Walkers Kanban',
    body: body || '',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon-512.png')
  });
  n.on('click', showWindow);
  n.show();
  return true;
});

// ─── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureFiles();
  // Sync OS login state with stored setting on boot (in case user toggled outside)
  const settings = loadSettings();
  applyAutoLaunch(settings.autoLaunch);

  // If launched with --hidden (from auto-launch), don't show the window immediately —
  // user can click the tray icon to open it.
  const startHidden = process.argv.includes('--hidden');

  createTray();
  createWindow();
  if (startHidden && mainWindow) {
    mainWindow.once('ready-to-show', () => { /* keep hidden */ });
  }

  setupAutoUpdater();
  // Check for updates 5s after boot so it doesn't slow startup
  setTimeout(() => triggerUpdateCheck(false), 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  // On Windows, with tray enabled we keep the app running even if window is "closed".
  // Only actually quit when isQuitting is true (user picked Quit from tray menu).
  if (process.platform === 'darwin') return;
  const settings = loadSettings();
  if (!settings.minimizeToTray || isQuitting) app.quit();
});

app.on('web-contents-created', (_, contents) => {
  contents.on('will-attach-webview', e => e.preventDefault());
});

const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('walkersAPI', {
  // Zoom nativo do Chromium/Electron — escala o viewport sem cortar conteúdo.
  setZoom: (factor) => { try { webFrame.setZoomFactor(Number(factor) || 1); } catch {} },
  getZoom: () => { try { return webFrame.getZoomFactor(); } catch { return 1; } },
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadNotifications: () => ipcRenderer.invoke('load-notifications'),
  saveNotifications: (n) => ipcRenderer.invoke('save-notifications', n),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  showDataFolder: () => ipcRenderer.invoke('show-data-folder'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onExternalChange: (cb) => {
    ipcRenderer.removeAllListeners('data-changed-externally');
    ipcRenderer.on('data-changed-externally', () => cb());
  },

  // Auth bridge (so the MCP server can talk to Firestore as the same user)
  saveAuth: (payload) => ipcRenderer.invoke('save-auth', payload),

  // Google OAuth Desktop Flow (refresh_token mode — persistent)
  googleOAuthStart: (clientId, clientSecret) => ipcRenderer.invoke('google-oauth-start', clientId, clientSecret),
  googleOAuthRefresh: () => ipcRenderer.invoke('google-oauth-refresh'),
  googleOAuthCancel: () => ipcRenderer.invoke('google-oauth-cancel'),
  setNextPopupSilent: (silent) => ipcRenderer.invoke('set-next-popup-silent', silent),
  googleOAuthClear: () => ipcRenderer.invoke('google-oauth-clear'),
  googleOAuthStatus: () => ipcRenderer.invoke('google-oauth-status'),
  onGoogleOAuthUrl: (cb) => {
    ipcRenderer.removeAllListeners('google-oauth-url');
    ipcRenderer.on('google-oauth-url', (_e, url) => cb(url));
  },

  // Settings + lifecycle
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch) => ipcRenderer.invoke('save-settings', patch),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdaterStatus: (cb) => {
    ipcRenderer.removeAllListeners('updater-status');
    ipcRenderer.on('updater-status', (_e, payload) => cb(payload));
  },

  // OS notifications (used for streak-at-risk alerts etc.)
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body })
});

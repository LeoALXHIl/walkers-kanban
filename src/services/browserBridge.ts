// ─── Browser compatibility bridge ───────────────────────────────
// No Electron, preload.js define window.walkersAPI (ponte IPC real). No
// navegador, ele é undefined — então instalamos aqui uma implementação
// browser-native, com IndexedDB (dados) + localStorage (settings). Assim o
// MESMO código do app roda na web sem mexer nos ~40 call sites.
//
// Só ativa quando window.walkersAPI NÃO existe → risco zero pro app desktop.
import type { AppData } from '@/types';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string) || '4.26.2';

// ─── IndexedDB key-value mínimo (sem dependências) ───────────────
const DB_NAME = 'walkers-kanban';
const STORE = 'kv';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key: string, val: unknown): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Settings em localStorage ────────────────────────────────────
const SETTINGS_KEY = 'walkers.settings.v1';
const DEFAULT_SETTINGS = { minimizeToTray: false, autoLaunch: false, notifications: true };

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function notAvailable(feature: string): never {
  throw new Error(`[walkers] "${feature}" não está disponível na versão web.`);
}

/**
 * Instala o shim de browser em window.walkersAPI se ele ainda não existir.
 * Retorna true se instalou (= rodando na web), false se já havia ponte (= Electron).
 */
export function installBrowserBridge(): boolean {
  if (typeof window === 'undefined' || (window as Window & { walkersAPI?: unknown }).walkersAPI) {
    return false; // Electron já forneceu a ponte real — nunca sobrescrever.
  }

  const api = {
    setZoom: (_factor: number) => {},
    getZoom: () => 1,

    // migrateData() não aceita null → retornamos {} quando vazio (ele preenche os defaults).
    loadData: async () => (await idbGet<AppData>('data')) ?? ({} as AppData),
    saveData: async (data: AppData) => { await idbSet('data', data); return true; },
    loadNotifications: async () => (await idbGet<unknown[]>('notifications')) ?? [],
    saveNotifications: async (n: unknown[]) => { await idbSet('notifications', n); return true; },

    getDataPath: async () => 'Navegador (IndexedDB)',
    showDataFolder: async () => {},
    openExternal: async (url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); },
    onExternalChange: (_cb: () => void) => {},

    // Bridge de auth alimenta o MCP local (só Electron). No-op na web.
    saveAuth: async (_payload: unknown) => true,

    // OAuth persistente é desktop-only. Reportar "ausente" faz o auth.ts cair
    // no popup padrão do Firebase, que funciona na web.
    googleOAuthStatus: async () => ({ hasRefreshToken: false, clientId: null, savedAt: null }),
    googleOAuthRefresh: async () => notAvailable('Modo persistente Google'),
    googleOAuthStart: async () => notAvailable('Modo persistente Google'),
    googleOAuthCancel: async () => true,
    googleOAuthClear: async () => true,
    setNextPopupSilent: async (_silent: boolean) => true,
    onGoogleOAuthUrl: (_cb: (url: string) => void) => {},

    getSettings: async () => readSettings(),
    saveSettings: async (patch: Record<string, unknown>) => {
      const next = { ...readSettings(), ...patch };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    },
    getAppVersion: async () => APP_VERSION,
    quitApp: async () => {},

    checkForUpdates: async () => false,
    installUpdate: async () => {},
    onUpdaterStatus: (_cb: (s: unknown) => void) => {},

    showNotification: async (title: string, body: string) => {
      try {
        if (typeof Notification === 'undefined') return false;
        if (Notification.permission === 'granted') { new Notification(title, { body }); return true; }
        if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') { new Notification(title, { body }); return true; }
        }
      } catch {}
      return false;
    }
  };

  (window as unknown as { walkersAPI: unknown; __walkersWebMode: boolean }).walkersAPI = api;
  (window as unknown as { __walkersWebMode: boolean }).__walkersWebMode = true;
  return true;
}

/** True quando rodando na versão web (shim instalado). */
export function isWebMode(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { __walkersWebMode?: boolean }).__walkersWebMode;
}

import type { AppData, Notification } from './types';

export interface AppSettings {
  minimizeToTray: boolean;
  autoLaunch: boolean;
  notifications: boolean;
}

export interface AuthBridgePayload {
  uid: string;
  email: string | null;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  apiKey: string;
  projectId: string;
}

export type UpdaterStatus =
  | { kind: 'available'; version: string }
  | { kind: 'none' }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable' };

declare global {
  interface Window {
    walkersAPI: {
      setZoom: (factor: number) => void;
      getZoom: () => number;
      loadData: () => Promise<AppData>;
      saveData: (data: AppData) => Promise<boolean>;
      loadNotifications: () => Promise<Notification[]>;
      saveNotifications: (n: Notification[]) => Promise<boolean>;
      getDataPath: () => Promise<string>;
      showDataFolder: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onExternalChange: (cb: () => void) => void;

      saveAuth: (payload: AuthBridgePayload | null) => Promise<boolean>;

      getSettings: () => Promise<AppSettings>;
      saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      getAppVersion: () => Promise<string>;
      quitApp: () => Promise<void>;

      checkForUpdates: () => Promise<boolean>;
      installUpdate: () => Promise<void>;
      onUpdaterStatus: (cb: (s: UpdaterStatus) => void) => void;

      showNotification: (title: string, body: string) => Promise<boolean>;

      // Google OAuth Desktop Flow (persistent refresh_token)
      googleOAuthStart: (clientId: string, clientSecret?: string) => Promise<{ access_token: string; expires_in: number; scope?: string }>;
      googleOAuthRefresh: () => Promise<{ access_token: string; expires_in: number; scope?: string }>;
      googleOAuthCancel: () => Promise<boolean>;
      setNextPopupSilent: (silent: boolean) => Promise<boolean>;
      googleOAuthClear: () => Promise<boolean>;
      googleOAuthStatus: () => Promise<{ hasRefreshToken: boolean; clientId: string | null; savedAt: number | null }>;
      onGoogleOAuthUrl: (cb: (url: string) => void) => void;
    };
  }
}

export {};

import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, onIdTokenChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, FIREBASE_API_KEY, FIREBASE_PROJECT_ID, GOOGLE_SCOPES } from '@/services/firebase';

interface AuthState {
  user: User | null;
  ready: boolean;
  // OAuth access token for Google APIs (Calendar/Gmail). Short-lived (~1h).
  googleAccessToken: string | null;
  googleTokenExpiresAt: number | null;
  // When true, the token was minted via the persistent OAuth flow (refresh_token mode)
  // — no popups needed for refresh, only via IPC.
  googleLifetimeMode: boolean;
  init: () => void;
  logout: () => Promise<void>;
  // Re-prompt Google sign-in to refresh Calendar/Gmail access (when token expires)
  reauthGoogle: () => Promise<string | null>;
  // Try to renew silently. Uses lifetime IPC refresh if available, else firebase popup with prompt:'none'.
  silentReauthGoogle: () => Promise<string | null>;
  setGoogleToken: (token: string | null, expiresInSec?: number, lifetime?: boolean) => void;
  // Lifetime mode: OAuth Desktop Flow (refresh_token persistent for ~6 months)
  startLifetimeOAuth: (clientId: string, clientSecret?: string) => Promise<string | null>;
  refreshLifetimeOAuth: () => Promise<string | null>;
  clearLifetimeOAuth: () => Promise<void>;
}

async function pushAuthBridge(user: User | null) {
  try {
    if (!user) {
      await window.walkersAPI.saveAuth(null);
      return;
    }
    const idToken = await user.getIdToken();
    const result = await user.getIdTokenResult();
    const expiresAt = new Date(result.expirationTime).getTime();
    await window.walkersAPI.saveAuth({
      uid: user.uid,
      email: user.email,
      idToken,
      refreshToken: (user as any).stsTokenManager?.refreshToken || (user as any).refreshToken || '',
      expiresAt,
      apiKey: FIREBASE_API_KEY,
      projectId: FIREBASE_PROJECT_ID
    });
  } catch (e) {
    console.error('[walkers] saveAuth bridge failed', e);
  }
}

const TOKEN_KEY = 'walkers.googleOAuth.v1';
const LIFETIME_KEY = 'walkers.googleOAuth.lifetime';

function loadCachedToken(): { token: string; expiresAt: number; lifetime: boolean } | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.expiresAt > Date.now() + 30_000) {
      return { ...parsed, lifetime: !!parsed.lifetime };
    }
    return null;
  } catch { return null; }
}

function persistToken(token: string | null, expiresAt: number | null, lifetime = false) {
  try {
    if (token && expiresAt) localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt, lifetime }));
    else localStorage.removeItem(TOKEN_KEY);
    if (lifetime) localStorage.setItem(LIFETIME_KEY, '1');
    else if (!token) localStorage.removeItem(LIFETIME_KEY);
  } catch {}
}

export const useAuth = create<AuthState>((set, get) => {
  // Hydrate from localStorage on init
  const cached = loadCachedToken();
  return {
    user: null,
    ready: false,
    googleAccessToken: cached?.token || null,
    googleTokenExpiresAt: cached?.expiresAt || null,
    googleLifetimeMode: cached?.lifetime || (typeof localStorage !== 'undefined' && !!localStorage.getItem(LIFETIME_KEY)),
    init: () => {
      onAuthStateChanged(auth, (u) => {
        set({ user: u, ready: true });
        pushAuthBridge(u);
      });
      onIdTokenChanged(auth, (u) => { if (u) pushAuthBridge(u); });
      // On boot, if we have a lifetime refresh_token in main process, immediately
      // get a fresh access_token without prompting the user.
      window.walkersAPI.googleOAuthStatus().then(async (status) => {
        if (status.hasRefreshToken) {
          try {
            const res = await window.walkersAPI.googleOAuthRefresh();
            get().setGoogleToken(res.access_token, res.expires_in, true);
            console.log('[walkers] Google lifetime token refreshed on boot');
          } catch (e) {
            console.warn('[walkers] Lifetime refresh on boot failed:', e);
          }
        }
      }).catch(() => {});
    },
    logout: async () => {
      try {
        await window.walkersAPI.saveAuth(null);
        get().setGoogleToken(null);
        await signOut(auth);
      } catch (e) { console.error(e); }
    },
    reauthGoogle: async () => {
      try {
        const provider = new GoogleAuthProvider();
        GOOGLE_SCOPES.forEach(s => provider.addScope(s));
        provider.setCustomParameters({ prompt: 'consent' });
        const result = await signInWithPopup(auth, provider);
        const cred = GoogleAuthProvider.credentialFromResult(result);
        if (cred?.accessToken) {
          // Google access tokens last ~3600s
          get().setGoogleToken(cred.accessToken, 3600);
          return cred.accessToken;
        }
        return null;
      } catch (e) {
        console.error('reauthGoogle failed', e);
        return null;
      }
    },
    silentReauthGoogle: async () => {
      // If we have a persistent refresh_token in main, use it — true silent renew.
      if (get().googleLifetimeMode) {
        try {
          const res = await window.walkersAPI.googleOAuthRefresh();
          get().setGoogleToken(res.access_token, res.expires_in, true);
          return res.access_token;
        } catch (e: any) {
          console.warn('[walkers] Lifetime refresh failed:', e.message);
          // Fall through to popup as last resort
        }
      }
      // Fallback: Firebase popup with prompt:'none' + hidden window — totally invisible
      // unless Google requires interaction (then we fail and the user sees a normal "reconectar" UI).
      try {
        // Ask main process to open the next auth popup HIDDEN. Valid for 15s.
        try { await window.walkersAPI.setNextPopupSilent(true); } catch {}
        const provider = new GoogleAuthProvider();
        GOOGLE_SCOPES.forEach(s => provider.addScope(s));
        provider.setCustomParameters({ prompt: 'none' });
        const result = await signInWithPopup(auth, provider);
        const cred = GoogleAuthProvider.credentialFromResult(result);
        if (cred?.accessToken) {
          get().setGoogleToken(cred.accessToken, 3600);
          return cred.accessToken;
        }
        return null;
      } catch (e: any) {
        // Clear the flag so a normal next popup is visible
        try { await window.walkersAPI.setNextPopupSilent(false); } catch {}
        console.warn('[walkers] silent Google reauth failed:', e.code || e.message);
        return null;
      }
    },
    setGoogleToken: (token, expiresInSec, lifetime = false) => {
      const expiresAt = token && expiresInSec ? Date.now() + expiresInSec * 1000 : null;
      set({ googleAccessToken: token, googleTokenExpiresAt: expiresAt, googleLifetimeMode: lifetime || (!!token && get().googleLifetimeMode) });
      persistToken(token, expiresAt, lifetime || get().googleLifetimeMode);
    },
    startLifetimeOAuth: async (clientId: string, clientSecret?: string) => {
      const res = await window.walkersAPI.googleOAuthStart(clientId, clientSecret);
      get().setGoogleToken(res.access_token, res.expires_in, true);
      return res.access_token;
    },
    refreshLifetimeOAuth: async () => {
      try {
        const res = await window.walkersAPI.googleOAuthRefresh();
        get().setGoogleToken(res.access_token, res.expires_in, true);
        return res.access_token;
      } catch { return null; }
    },
    clearLifetimeOAuth: async () => {
      await window.walkersAPI.googleOAuthClear();
      set({ googleLifetimeMode: false, googleAccessToken: null, googleTokenExpiresAt: null });
      persistToken(null, null, false);
    }
  };
});

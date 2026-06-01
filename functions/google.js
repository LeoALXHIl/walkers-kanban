// Conexão Google PERSISTENTE via proxy total (Sprint pós-OAuth).
//
// O navegador NUNCA vê o refresh_token nem fala direto com o Google.
//   1) googleOAuthCallback (HTTP): recebe ?code&state, troca por tokens usando
//      o client_secret (secret das Functions), guarda o refresh_token em
//      `googleAuth/{uid}` — coleção BLOQUEADA pro cliente (só Admin SDK lê).
//   2) googleCalendar (callable): usa o refresh_token pra mintar um access_token
//      fresco e chamar a Calendar API; devolve só os dados ao cliente.
//   3) googleStatus / googleDisconnect (callable): estado e revogação.
//
// Node 20 → fetch global (sem dependências novas).

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

// client_id é público (pode ir no frontend); client_secret é secreto.
const GOOGLE_CLIENT_ID = defineString('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];
const APP_ORIGIN = 'https://walkerskambam.web.app';
const REDIRECT_URI = `${APP_ORIGIN}/api/google/callback`;
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Cache de access_token por instância (warm), chaveado por uid.
const tokenCache = new Map(); // uid -> { token, exp }

function tokenDoc(uid) {
  return admin.firestore().doc(`googleAuth/${uid}`);
}
function statusDoc(uid) {
  // Doc LEGÍVEL pelo dono (regra users/{uid}/**) — só um booleano + email, sem segredo.
  return admin.firestore().doc(`users/${uid}/integrations/google`);
}

// Troca o refresh_token por um access_token novo (com cache curto em memória).
async function getAccessToken(uid) {
  const cached = tokenCache.get(uid);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const snap = await tokenDoc(uid).get();
  if (!snap.exists || !snap.data().refreshToken) {
    throw new HttpsError('failed-precondition', 'Google não conectado. Conecte em Integrações.');
  }
  const refreshToken = snap.data().refreshToken;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID.value(),
      client_secret: GOOGLE_CLIENT_SECRET.value(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    // refresh_token revogado/inválido → marca como desconectado.
    if (res.status === 400 || res.status === 401) {
      await tokenDoc(uid).delete().catch(() => {});
      await statusDoc(uid).set({ connected: false }, { merge: true }).catch(() => {});
    }
    throw new HttpsError('permission-denied', 'Não foi possível renovar o acesso Google. Reconecte.');
  }
  const token = json.access_token;
  const exp = Date.now() + (json.expires_in || 3600) * 1000;
  tokenCache.set(uid, { token, exp });
  return token;
}

async function callGoogle(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new HttpsError('internal', `Google API ${res.status}: ${(json.error && json.error.message) || text.slice(0, 200)}`);
  }
  return json;
}

// ─── 1) Callback do OAuth (troca code → tokens, guarda refresh_token) ─────────
const googleOAuthCallback = onRequest(
  { secrets: [GOOGLE_CLIENT_SECRET], region: 'us-central1' },
  async (req, res) => {
    try {
      const code = req.query.code;
      const state = req.query.state; // = Firebase ID token do usuário
      if (req.query.error) return res.redirect(`${APP_ORIGIN}/?google=error`);
      if (!code || !state) return res.redirect(`${APP_ORIGIN}/?google=error`);

      // Verifica a identidade do usuário a partir do state (ID token do Firebase).
      let uid, email;
      try {
        const decoded = await admin.auth().verifyIdToken(String(state));
        uid = decoded.uid;
        email = decoded.email || null;
      } catch (e) {
        logger.warn('OAuth callback: state inválido', e);
        return res.redirect(`${APP_ORIGIN}/?google=error`);
      }

      // Troca o code pelos tokens.
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: GOOGLE_CLIENT_ID.value(),
          client_secret: GOOGLE_CLIENT_SECRET.value(),
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });
      const tok = await tokenRes.json();
      if (!tokenRes.ok || !tok.refresh_token) {
        logger.error('OAuth token exchange falhou', tok);
        // Sem refresh_token costuma significar que faltou prompt=consent/access_type=offline.
        return res.redirect(`${APP_ORIGIN}/?google=norefresh`);
      }

      await tokenDoc(uid).set({
        refreshToken: tok.refresh_token,
        scope: tok.scope || SCOPES.join(' '),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await statusDoc(uid).set({
        connected: true,
        email,
        connectedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Cacheia o access_token já obtido (evita um refresh imediato).
      if (tok.access_token) {
        tokenCache.set(uid, { token: tok.access_token, exp: Date.now() + (tok.expires_in || 3600) * 1000 });
      }

      return res.redirect(`${APP_ORIGIN}/?google=connected`);
    } catch (e) {
      logger.error('googleOAuthCallback erro', e);
      return res.redirect(`${APP_ORIGIN}/?google=error`);
    }
  }
);

// ─── 2) Proxy de Calendar (cliente nunca toca no token) ───────────────────────
const googleCalendar = onCall(
  { secrets: [GOOGLE_CLIENT_SECRET], region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login.');
    const uid = request.auth.uid;
    const { action, calendarId = 'primary' } = request.data || {};
    const token = await getAccessToken(uid);
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    if (action === 'list') {
      const { timeMin, timeMax, maxResults = 250 } = request.data || {};
      const params = new URLSearchParams({
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: String(maxResults)
      });
      const data = await callGoogle(token, `${base}?${params}`);
      return { items: data.items || [] };
    }

    if (action === 'create') {
      const { event, createMeet, sendUpdates } = request.data || {};
      const params = new URLSearchParams();
      if (createMeet) params.set('conferenceDataVersion', '1');
      if (sendUpdates) params.set('sendUpdates', 'all');
      const url = `${base}${params.toString() ? '?' + params : ''}`;
      const data = await callGoogle(token, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      return { event: data };
    }

    throw new HttpsError('invalid-argument', `Ação desconhecida: ${action}`);
  }
);

// ─── 3) Status + desconectar ──────────────────────────────────────────────────
const googleStatus = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login.');
  const snap = await tokenDoc(request.auth.uid).get();
  return { connected: snap.exists && !!snap.data().refreshToken };
});

const googleDisconnect = onCall(
  { secrets: [GOOGLE_CLIENT_SECRET], region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login.');
    const uid = request.auth.uid;
    // Tenta revogar o refresh_token no Google (best-effort).
    try {
      const snap = await tokenDoc(uid).get();
      const rt = snap.exists ? snap.data().refreshToken : null;
      if (rt) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rt)}`, { method: 'POST' });
    } catch (e) { logger.warn('revoke falhou', e); }
    tokenCache.delete(uid);
    await tokenDoc(uid).delete().catch(() => {});
    await statusDoc(uid).set({ connected: false }, { merge: true }).catch(() => {});
    return { ok: true };
  }
);

module.exports = { googleOAuthCallback, googleCalendar, googleStatus, googleDisconnect };

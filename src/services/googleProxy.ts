// Cliente da conexão Google PERSISTENTE (proxy total via Cloud Functions).
// O navegador nunca vê tokens do Google: o connect manda o usuário pro consent
// e o callback (Function) guarda o refresh_token; as leituras de Calendar passam
// pela callable `googleCalendar`. Inerte até VITE_GOOGLE_OAUTH_CLIENT_ID existir.

import { httpsCallable } from 'firebase/functions';
import { functions, auth, GOOGLE_OAUTH_WEB_CLIENT_ID } from './firebase';
import type { GoogleEvent, CreateMeetingPayload } from './google';

const REDIRECT_URI = 'https://walkerskambam.web.app/api/google/callback';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

export function isPersistentConfigured(): boolean {
  return !!GOOGLE_OAUTH_WEB_CLIENT_ID;
}

// Redireciona pro consent do Google. O state leva o ID token do Firebase, que o
// callback verifica pra saber QUEM está conectando (sem sessão/cookie no meio).
export async function connectGooglePersistent(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login primeiro.');
  if (!GOOGLE_OAUTH_WEB_CLIENT_ID) throw new Error('Conexão persistente não configurada (VITE_GOOGLE_OAUTH_CLIENT_ID).');
  const idToken = await user.getIdToken();
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_WEB_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: idToken
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function googleStatus(): Promise<boolean> {
  const fn = httpsCallable<unknown, { connected: boolean }>(functions, 'googleStatus');
  const res = await fn({});
  return !!res.data.connected;
}

export async function disconnectGoogle(): Promise<void> {
  const fn = httpsCallable<unknown, { ok: boolean }>(functions, 'googleDisconnect');
  await fn({});
}

// Mesmos tipos de retorno do services/google.ts → troca quase drop-in no Calendar.
export async function listCalendarEventsProxy(rangeStart: Date, rangeEnd: Date, calendarId = 'primary'): Promise<GoogleEvent[]> {
  const fn = httpsCallable<unknown, { items: GoogleEvent[] }>(functions, 'googleCalendar');
  const res = await fn({
    action: 'list',
    calendarId,
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    maxResults: 250
  });
  return res.data.items || [];
}

export async function createCalendarEventProxy(payload: CreateMeetingPayload, calendarId = 'primary'): Promise<GoogleEvent> {
  const tz = payload.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const event: Record<string, unknown> = {
    summary: payload.summary,
    description: payload.description || '',
    start: { dateTime: payload.startISO, timeZone: tz },
    end: { dateTime: payload.endISO, timeZone: tz },
    attendees: (payload.attendeeEmails || []).map((email) => ({ email }))
  };
  if (payload.createMeet) {
    event.conferenceData = {
      createRequest: {
        requestId: 'wk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }
  const fn = httpsCallable<unknown, { event: GoogleEvent }>(functions, 'googleCalendar');
  const res = await fn({ action: 'create', calendarId, event, createMeet: !!payload.createMeet, sendUpdates: !!payload.sendUpdates });
  return res.data.event;
}

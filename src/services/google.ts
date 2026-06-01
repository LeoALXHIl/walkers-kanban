// Wrappers for Google Calendar + Gmail REST APIs.
// Uses the OAuth access token cached in useAuth (obtained via signInWithPopup).
import { useAuth } from '@/store/auth';

class GoogleAuthError extends Error {
  constructor(public reason: 'no-token' | 'expired' | 'api-disabled' | 'forbidden' | 'http', message: string) {
    super(message);
  }
}

async function getToken(): Promise<string> {
  const state = useAuth.getState();
  if (!state.googleAccessToken || !state.googleTokenExpiresAt) {
    throw new GoogleAuthError('no-token', 'Sem token Google. Reautentique com Google em Integrações.');
  }
  if (state.googleTokenExpiresAt <= Date.now() + 30_000) {
    throw new GoogleAuthError('expired', 'Token Google expirou. Reautentique em Integrações.');
  }
  return state.googleAccessToken;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface FetchOpts { method?: string; body?: any; }
async function gfetch<T = any>(url: string, opts: FetchOpts = {}, attempt = 0): Promise<T> {
  const token = await getToken();
  const method = opts.method || 'GET';
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {})
  };
  const res = await fetch(url, init);
  // Retry on 429 (rate limit / concurrency) with exponential backoff up to 3 attempts
  if (res.status === 429 && attempt < 3) {
    const wait = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
    await sleep(wait);
    return gfetch<T>(url, opts, attempt + 1);
  }
  if (res.status === 401) {
    useAuth.getState().setGoogleToken(null);
    throw new GoogleAuthError('expired', 'Sessão Google expirou. Reconecte em Integrações.');
  }
  if (res.status === 403) {
    const text = await res.text().catch(() => '');
    // Common Google 403: API not enabled in the GCP project
    if (/has not been used in project|disabled|SERVICE_DISABLED/i.test(text)) {
      const apiMatch = text.match(/(gmail|calendar|tasks|drive|sheets)[\w.-]*api/i);
      const apiName = apiMatch ? apiMatch[0] : 'esta API';
      throw new GoogleAuthError('api-disabled',
        `${apiName} não está ativada no projeto Firebase. Vai em https://console.cloud.google.com/apis/library?project=192188793356 e ativa ela.`);
    }
    if (/insufficient|invalid_scope|access not granted/i.test(text)) {
      throw new GoogleAuthError('forbidden',
        'Você não autorizou o scope necessário. Em Integrações, clique em "Reconectar com Google" e aceita as permissões.');
    }
    throw new GoogleAuthError('forbidden', `Google API 403: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GoogleAuthError('http', `Google API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Calendar ─────────────────────────────────────────────────
export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string; label?: string }>;
    conferenceSolution?: { name: string; iconUri?: string };
  };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  htmlLink?: string;
  status?: string;
}

export async function listCalendarEvents(rangeStart: Date, rangeEnd: Date, calendarId = 'primary'): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250'
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const data = await gfetch<{ items: GoogleEvent[] }>(url);
  return data.items || [];
}

// ─── Calendar: Create event ──────────────────────────────────
export interface CreateMeetingPayload {
  summary: string;             // title
  description?: string;
  startISO: string;            // full ISO with timezone
  endISO: string;
  attendeeEmails?: string[];
  createMeet?: boolean;        // adds Google Meet conference link
  sendUpdates?: boolean;       // emails invite to attendees
  timeZone?: string;
}

export async function createCalendarEvent(payload: CreateMeetingPayload, calendarId = 'primary'): Promise<GoogleEvent> {
  const tz = payload.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const body: any = {
    summary: payload.summary,
    description: payload.description || '',
    start: { dateTime: payload.startISO, timeZone: tz },
    end:   { dateTime: payload.endISO,   timeZone: tz },
    attendees: (payload.attendeeEmails || []).map(email => ({ email }))
  };
  if (payload.createMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: 'wk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }
  const params = new URLSearchParams();
  if (payload.createMeet) params.set('conferenceDataVersion', '1');
  if (payload.sendUpdates) params.set('sendUpdates', 'all');
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${params.toString() ? '?' + params : ''}`;
  return await gfetch<GoogleEvent>(url, { method: 'POST', body });
}

export function eventMeetingLink(ev: GoogleEvent): string | null {
  if (ev.hangoutLink) return ev.hangoutLink;
  const entry = ev.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video');
  if (entry?.uri) return entry.uri;
  // Try to extract URL from description/location
  const urlRe = /(https?:\/\/(?:[^\s<>"]+))/;
  const fromLoc = ev.location?.match(urlRe);
  if (fromLoc) return fromLoc[1];
  const fromDesc = ev.description?.match(urlRe);
  if (fromDesc) return fromDesc[1];
  return null;
}

// ─── Gmail ─────────────────────────────────────────────────────
export interface GmailMessageBrief {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  subject?: string;
  date?: string;
  labelIds?: string[];
}

interface GmailHeader { name: string; value: string }

function findHeader(headers: GmailHeader[] | undefined, name: string): string | undefined {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

// Process items in batches to respect Gmail's per-user concurrency limit (~4 simultaneous)
async function batchProcess<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function listGmailMessages(query = 'in:inbox', maxResults = 15): Promise<GmailMessageBrief[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`;
  const list = await gfetch<{ messages?: Array<{ id: string; threadId: string }> }>(listUrl);
  if (!list.messages || list.messages.length === 0) return [];
  // Fetch metadata 4-at-a-time to avoid 429 "too many concurrent requests"
  const briefs = await batchProcess(list.messages, 4, async (m: { id: string; threadId: string }) => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
    const msg = await gfetch<any>(url);
    return {
      id: m.id,
      threadId: m.threadId,
      snippet: msg.snippet || '',
      from: findHeader(msg.payload?.headers, 'From'),
      subject: findHeader(msg.payload?.headers, 'Subject'),
      date: findHeader(msg.payload?.headers, 'Date'),
      labelIds: msg.labelIds || []
    } as GmailMessageBrief;
  });
  return briefs;
}

export async function getGmailMessageBody(id: string): Promise<{ subject: string; from: string; body: string; date: string }> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const msg = await gfetch<any>(url);
  const subject = findHeader(msg.payload?.headers, 'Subject') || '(sem assunto)';
  const from = findHeader(msg.payload?.headers, 'From') || '';
  const date = findHeader(msg.payload?.headers, 'Date') || '';
  // Walk payload parts to find text body
  const body = extractBody(msg.payload) || msg.snippet || '';
  return { subject, from, body, date };
}

function extractBody(part: any): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return b64UrlDecode(part.body.data);
  }
  if (part.parts) {
    // Prefer text/plain over text/html
    for (const p of part.parts) {
      if (p.mimeType === 'text/plain') {
        const t = extractBody(p);
        if (t) return t;
      }
    }
    for (const p of part.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  // Fallback to HTML stripped
  if (part.mimeType === 'text/html' && part.body?.data) {
    return stripHtml(b64UrlDecode(part.body.data));
  }
  return '';
}

function b64UrlDecode(input: string): string {
  try {
    const norm = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = norm + '='.repeat((4 - norm.length % 4) % 4);
    const binary = atob(padded);
    // Decode as UTF-8
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return ''; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export { GoogleAuthError };

// ─── Gmail: enviar mensagem ───────────────────────────────────
// base64 padrão (UTF-8 safe) — usado pra codificar o Subject.
function b64utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
// base64url (sem padding) — formato exigido pelo campo `raw` do Gmail.
function b64url(str: string): string {
  return b64utf8(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Envia um email HTML pela conta Google autenticada (From = você).
// Requer o scope gmail.send (reconectar Google se acabou de ativar).
export async function sendGmailMessage(to: string, subject: string, html: string): Promise<void> {
  const encodedSubject = `=?UTF-8?B?${b64utf8(subject)}?=`;
  const raw = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html
  ].join('\r\n');
  await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: { raw: b64url(raw) }
  });
}

// Helper: pretty-print sender ("Maria <maria@x.com>" → "Maria")
export function prettySender(from: string | undefined): string {
  if (!from) return 'Desconhecido';
  const m = from.match(/^"?([^"<]+?)"?\s*<.+>$/);
  if (m) return m[1].trim();
  return from;
}

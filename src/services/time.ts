// Time-since formatter ("há 3min", "há 2h", "há 5d", "12 mai").
// Always returns a short pt-BR phrase.
export function timeSince(ts: number | undefined | null): string {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  if (diff < 0) return 'no futuro';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  if (days < 30) return `há ${Math.floor(days / 7)}sem`;
  if (days < 365) return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

// Smart due date parser — accepts pt-BR natural phrases and returns YYYY-MM-DD or null.
// Supported:
//   "hoje", "amanhã", "depois de amanhã"
//   "seg/ter/qua/qui/sex/sab/dom" (next occurrence)
//   "próx segunda", "próx sexta"
//   "em 3 dias", "em 2 semanas"
//   "dia 15", "dia 30/jun", "30/06", "30/06/2025"
//   raw ISO "2025-06-30"
export function parseSmartDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ymd = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  if (/^hoje$/.test(s)) return ymd(today);
  if (/^amanh[aã]$/.test(s)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return ymd(d);
  }
  if (/^depois de amanh[aã]$/.test(s) || /^pasado amanh[aã]$/.test(s)) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return ymd(d);
  }

  // "em N dias" / "em N semanas"
  const m1 = s.match(/^em (\d+) ?(dias?|semanas?|sem|d)$/);
  if (m1) {
    const n = parseInt(m1[1]);
    const unit = m1[2];
    const d = new Date(today);
    d.setDate(d.getDate() + (unit.startsWith('sem') ? n * 7 : n));
    return ymd(d);
  }

  // Day of week (próxima ocorrência)
  const dows: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
  const dowMatch = s.match(/^(?:pr[oó]x\.? |próxima? |próximo )?(seg|ter|qua|qui|sex|sab|dom)(?:unda|ça|rta|nta|ado|ingo)?$/);
  if (dowMatch) {
    const target = dows[dowMatch[1]];
    const cur = today.getDay();
    let delta = (target - cur + 7) % 7;
    if (delta === 0) delta = 7; // "próx segunda" quando hoje é segunda = próxima semana
    const d = new Date(today); d.setDate(d.getDate() + delta);
    return ymd(d);
  }

  // dd/mm or dd/mm/yyyy
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m2) {
    const day = parseInt(m2[1]);
    const month = parseInt(m2[2]) - 1;
    let year = m2[3] ? parseInt(m2[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return ymd(d);
  }

  // "dia 15" / "dia 30 jun"
  const months: Record<string, number> = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
  };
  const m3 = s.match(/^dia (\d{1,2})(?:[\/ ](jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez))?$/);
  if (m3) {
    const day = parseInt(m3[1]);
    const month = m3[2] ? months[m3[2]] : today.getMonth();
    let year = today.getFullYear();
    // If date is in the past this year, assume next year
    const candidate = new Date(year, month, day);
    if (candidate.getTime() < today.getTime()) year++;
    const d = new Date(year, month, day);
    return ymd(d);
  }

  return null;
}

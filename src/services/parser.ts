// Heuristic parser that turns a free-form transcript (voice or OCR) into
// pre-filled card fields. Conservative: when in doubt, dumps the text into
// `note` and lets the user clean up in the modal.
import type { Platform, Priority } from '@/types';

export interface ParsedCard {
  name: string;
  note: string;
  prio?: Priority;
  plat: Platform[];
  due?: string;
}

const PRIO_RULES: Array<[RegExp, Priority]> = [
  [/\b(urgente|urgência|alta\s+prioridade|prioridade\s+alta|asap|crítico|crítica|critico|critica)\b/i, 'high'],
  [/\b(prioridade\s+baixa|baixa\s+prioridade|tranquilo|sem\s+pressa)\b/i, 'low'],
  [/\b(prioridade\s+média|média\s+prioridade|normal)\b/i, 'med']
];

const PLAT_RULES: Array<[RegExp, Platform]> = [
  [/\b(whats(?:app)?|wpp|zap)\b/i, 'wpp'],
  [/\b(insta(?:gram)?|ig)\b/i, 'insta'],
  [/\b(messenger|msg|facebook|fb)\b/i, 'msg']
];

const WEEKDAYS: Record<string, number> = {
  'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2,
  'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function findDate(text: string): string | undefined {
  const t = text.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/\bhoje\b/.test(t)) return toDateStr(today);
  // "depois de amanhã" precisa ser checado ANTES de "amanhã" (senão casaria +1).
  // Usamos lookahead (?![\p{L}]) em vez de \b porque \b é ASCII e não reconhece
  // o "ã" acentuado — sem isso, "amanhã" (grafia correta) nunca era detectado.
  if (/\bdepois\s+de\s+amanh(?:ã|a)(?![\p{L}])/u.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return toDateStr(d);
  }
  if (/\bamanh(?:ã|a)(?![\p{L}])/u.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return toDateStr(d);
  }
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(t)) {
      const d = new Date(today);
      const cur = d.getDay();
      let diff = (dow - cur + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return toDateStr(d);
    }
  }
  // 20/05, 20/05/26, 20-05-26
  const m = t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return undefined;
}

function stripPunctuation(s: string): string {
  return s.replace(/[.,;!?]+\s*$/g, '').trim();
}

export function parseTranscript(raw: string): ParsedCard {
  const text = (raw || '').trim();
  if (!text) return { name: '', note: '', plat: [] };

  let prio: Priority | undefined;
  for (const [re, p] of PRIO_RULES) {
    if (re.test(text)) { prio = p; break; }
  }

  const plat: Platform[] = [];
  for (const [re, p] of PLAT_RULES) {
    if (re.test(text) && !plat.includes(p)) plat.push(p);
  }

  const due = findDate(text);

  // Try to extract the client name from common patterns:
  //   "cliente Maria ..."
  //   "card pra Maria ..."
  //   "novo cliente Maria ..."
  //   else: first 4-5 words as name
  let name = '';
  const namePatterns = [
    /\bcliente\s+(?:novo\s+)?([\p{L}\s\-']{2,40}?)(?=\s+(?:no|na|whats|insta|messenger|urgente|amanh|hoje|priorid|com|que)\b|[.,;]|$)/iu,
    /\b(?:cria(?:r)?|criar?|novo)\s+card(?:\s+(?:pra|pro|para))?\s+([\p{L}\s\-']{2,40}?)(?=\s+(?:no|na|whats|insta|messenger|urgente|amanh|hoje|priorid|com|que)\b|[.,;]|$)/iu,
    /\b(?:pra|pro|para)\s+(?:o\s+|a\s+)?([\p{L}][\p{L}\s\-']{1,40}?)(?=\s+(?:no|na|whats|insta|messenger|urgente|amanh|hoje|priorid|com|que)\b|[.,;]|$)/iu
  ];
  for (const re of namePatterns) {
    const m = text.match(re);
    if (m && m[1]) { name = stripPunctuation(m[1]); break; }
  }
  if (!name) {
    // fallback: first 5 words, removing leading filler
    const words = text.replace(/^(ok|então|olha|tipo|hum|hum,)\s+/i, '').split(/\s+/);
    name = stripPunctuation(words.slice(0, 5).join(' '));
  }
  if (name.length > 60) name = name.slice(0, 60) + '…';

  return {
    name,
    note: text,
    prio,
    plat,
    due
  };
}

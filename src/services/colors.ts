export const CARD_COLORS = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#f87171','#ec4899','#38bdf8','#a3e635','#fb923c'];
export const COL_COLORS  = ['#3b82f6','#a855f7','#f59e0b','#22c55e','#f87171','#ec4899','#38bdf8','#6366f1','#10b981'];
export const TAG_COLORS  = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#38bdf8','#10b981'];

export function pickHashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function safeUrl(u: string): string {
  u = String(u || '').trim();
  if (!u) return '';
  const dec = u
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const lower = dec.toLowerCase().replace(/[\s\-]/g, '');
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:') || lower.startsWith('file:')) return '';
  if (/^(https?:|mailto:)/i.test(dec)) return dec;
  if (dec.startsWith('/') || dec.startsWith('#')) return dec;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(dec)) return 'https://' + dec;
  return '';
}

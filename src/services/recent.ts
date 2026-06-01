// Tracks the last N opened cards for quick re-access (Cmd+K palette).
const KEY = 'walkers.recentCards.v1';
const MAX = 10;

export function pushRecentCard(id: string): void {
  if (!id) return;
  try {
    const list = getRecentCards().filter(x => x !== id);
    list.unshift(id);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
}

export function getRecentCards(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

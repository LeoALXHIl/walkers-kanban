// Daily snapshots of column distribution per board.
// Stored in localStorage as: walkers.flow.{wsId}.{boardId}.{YYYY-MM-DD} = { colId: count, ... }
import type { AppData } from '@/types';

const KEY = 'walkers.flowSnapshots.v1';

interface AllSnapshots {
  // boardId -> date(YYYY-MM-DD) -> { colId: count }
  [boardId: string]: { [date: string]: { [colId: string]: number } };
}

function load(): AllSnapshots {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}

function save(s: AllSnapshots): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Save today's snapshot for the active board. Call on data changes.
export function captureSnapshot(data: AppData): void {
  const bid = data.activeBoardId;
  if (!bid) return;
  const cols = data.cols.filter(c => !c.boardId || c.boardId === bid);
  const cards = data.cards.filter(c => !c.archived && (!c.boardId || c.boardId === bid));
  const counts: { [colId: string]: number } = {};
  cols.forEach(c => { counts[c.id] = 0; });
  cards.forEach(c => {
    if (counts[c.cid] !== undefined) counts[c.cid]++;
  });
  const all = load();
  if (!all[bid]) all[bid] = {};
  all[bid][todayKey()] = counts;
  // Keep only last 90 days per board
  const keys = Object.keys(all[bid]).sort();
  if (keys.length > 90) {
    keys.slice(0, keys.length - 90).forEach(k => delete all[bid][k]);
  }
  save(all);
}

// Get snapshots for a board (last N days). Returns array sorted by date asc.
export function getSnapshots(boardId: string, days = 30): Array<{ date: string; counts: { [colId: string]: number } }> {
  const all = load();
  const board = all[boardId];
  if (!board) return [];
  const keys = Object.keys(board).sort();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: Array<{ date: string; counts: { [colId: string]: number } }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (board[key]) {
      result.push({ date: key, counts: board[key] });
    }
  }
  return result;
}

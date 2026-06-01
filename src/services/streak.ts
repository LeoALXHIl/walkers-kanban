import type { AppData, DailyActivity, MutationKind, Streak } from '@/types';

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(s: string): Date {
  // YYYY-MM-DD → local midnight
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function diffDays(aStr: string, bStr: string): number {
  const a = parseDay(aStr).getTime();
  const b = parseDay(bStr).getTime();
  return Math.round((b - a) / 86400000);
}

// ISO week id "YYYY-Www"
export function weekId(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function defaultStreak(): Streak {
  return {
    current: 0,
    longest: 0,
    lastActivityDay: null,
    startedAt: null,
    lastWrapShownWeek: null
  };
}

export function defaultActivity(): DailyActivity {
  return { total: 0, cardsCreated: 0, cardsCompleted: 0, cardsMoved: 0, comments: 0 };
}

// Prune activity older than 90 days to keep doc small
const KEEP_DAYS = 90;
export function pruneActivity(data: AppData): void {
  if (!data.activity) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const cutoffStr = todayStr(cutoff);
  for (const key of Object.keys(data.activity)) {
    if (key < cutoffStr) delete data.activity[key];
  }
}

// Mutate AppData in place: record activity for today and bump streak
export function recordActivity(data: AppData, kind: MutationKind): void {
  if (!data.streak) data.streak = defaultStreak();
  if (!data.activity) data.activity = {};

  const today = todayStr();
  if (!data.activity[today]) data.activity[today] = defaultActivity();
  const a = data.activity[today];
  a.total++;
  if (kind === 'create') a.cardsCreated++;
  else if (kind === 'complete') a.cardsCompleted++;
  else if (kind === 'move') a.cardsMoved++;
  else if (kind === 'comment') a.comments++;

  // Update streak based on lastActivityDay
  const s = data.streak;
  if (s.lastActivityDay === today) return; // already counted today

  if (!s.lastActivityDay) {
    s.current = 1;
    s.startedAt = today;
  } else {
    const gap = diffDays(s.lastActivityDay, today);
    if (gap === 1) {
      s.current++;
    } else if (gap > 1) {
      s.current = 1;
      s.startedAt = today;
    }
    // gap <= 0 shouldn't happen (means clock changed); ignore
  }
  s.lastActivityDay = today;
  if (s.current > s.longest) s.longest = s.current;
}

// If user hasn't been active for >1 day, the displayed streak should be 0
export function effectiveStreak(s?: Streak): number {
  if (!s || !s.lastActivityDay) return 0;
  const gap = diffDays(s.lastActivityDay, todayStr());
  if (gap > 1) return 0;
  return s.current;
}

export function streakAtRisk(s?: Streak): boolean {
  if (!s || !s.lastActivityDay || s.current < 2) return false;
  return diffDays(s.lastActivityDay, todayStr()) === 1; // yesterday — today no activity yet
}

// Aggregate stats for a range (last N days)
export interface RangeStats {
  days: number;
  total: number;
  cardsCreated: number;
  cardsCompleted: number;
  cardsMoved: number;
  comments: number;
  activeDays: number;
  topDay: { date: string; total: number } | null;
}

export function aggregate(data: AppData, days: number): RangeStats {
  const out: RangeStats = { days, total: 0, cardsCreated: 0, cardsCompleted: 0, cardsMoved: 0, comments: 0, activeDays: 0, topDay: null };
  if (!data.activity) return out;
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = todayStr(d);
    const a = data.activity[key];
    if (!a) continue;
    out.total += a.total;
    out.cardsCreated += a.cardsCreated;
    out.cardsCompleted += a.cardsCompleted;
    out.cardsMoved += a.cardsMoved;
    out.comments += a.comments;
    if (a.total > 0) out.activeDays++;
    if (!out.topDay || a.total > out.topDay.total) out.topDay = { date: key, total: a.total };
  }
  return out;
}

// Build a heatmap grid (weeks × days), most-recent-week last
export interface HeatmapCell { date: string; count: number; isToday: boolean; }
export function buildHeatmap(data: AppData, weeks: number = 12): HeatmapCell[][] {
  const grid: HeatmapCell[][] = [];
  const today = new Date();
  // Align to last Sunday so the right-most column ends on today
  const endOfWeek = new Date(today);
  // We want grid[col][row] where row 0=Mon, 6=Sun
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - totalDays + 1);
  // Align start to a Monday
  const startDow = (start.getDay() + 6) % 7; // 0=Mon..6=Sun
  start.setDate(start.getDate() - startDow);

  const todayKey = todayStr();
  let cursor = new Date(start);
  for (let col = 0; col < weeks + 2; col++) {
    const week: HeatmapCell[] = [];
    for (let row = 0; row < 7; row++) {
      const date = todayStr(cursor);
      const count = data.activity?.[date]?.total || 0;
      week.push({ date, count, isToday: date === todayKey });
      cursor.setDate(cursor.getDate() + 1);
      if (cursor > today && row === 6 && col >= weeks - 1) break;
    }
    grid.push(week);
    if (cursor > today) break;
  }
  return grid;
}

export function isPreviousWeek(weekIdStr: string | null): boolean {
  if (!weekIdStr) return true;
  return weekIdStr !== weekId();
}

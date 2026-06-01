// Analytics insights derived from cards + activity log.
// All computations are pure functions over AppData.

import type { AppData, Card } from '@/types';
import { aggregate, parseDay, todayStr } from './streak';
import { allClients } from './clients';

export interface FunnelStage {
  colId: string;
  colName: string;
  color: string;
  count: number;
  pctOfTotal: number;
}

export function funnel(data: AppData): FunnelStage[] {
  const total = data.cards.length || 1;
  return data.cols.map(col => {
    const count = data.cards.filter(c => c.cid === col.id).length;
    return {
      colId: col.id,
      colName: col.name,
      color: col.color,
      count,
      pctOfTotal: Math.round((count / total) * 100)
    };
  });
}

export interface AvgTimeStage {
  colId: string;
  colName: string;
  color: string;
  count: number;
  avgDaysFromCreation: number;  // for cards currently here: avg days since card.ts
}

export function avgTimeInColumns(data: AppData): AvgTimeStage[] {
  const now = Date.now();
  return data.cols.map(col => {
    const cardsHere = data.cards.filter(c => c.cid === col.id);
    if (cardsHere.length === 0) {
      return { colId: col.id, colName: col.name, color: col.color, count: 0, avgDaysFromCreation: 0 };
    }
    const totalMs = cardsHere.reduce((s, c) => s + (now - (c.ts || now)), 0);
    return {
      colId: col.id,
      colName: col.name,
      color: col.color,
      count: cardsHere.length,
      avgDaysFromCreation: Math.round(totalMs / cardsHere.length / 86400000 * 10) / 10
    };
  });
}

// 7×24 productivity heatmap (day-of-week × hour-of-day).
// Currently derived from card.ts only — when each card was CREATED.
// Future: could use activity log for actual completion events.
export function productivityHeatmap(data: AppData): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  data.cards.forEach(c => {
    if (!c.ts) return;
    const d = new Date(c.ts);
    const dow = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
    const h = d.getHours();
    grid[dow][h]++;
  });
  return grid;
}

export interface TopClient {
  displayName: string;
  totalCards: number;
  doneCards: number;
  pct: number;
}

export function topClients(data: AppData, limit = 5): TopClient[] {
  return allClients(data)
    .map(c => ({
      displayName: c.displayName,
      totalCards: c.totalCards,
      doneCards: c.doneCards,
      pct: c.totalCards > 0 ? Math.round((c.doneCards / c.totalCards) * 100) : 0
    }))
    .sort((a, b) => b.totalCards - a.totalCards)
    .slice(0, limit);
}

export interface PlatformStat {
  plat: 'wpp' | 'insta' | 'msg';
  label: string;
  count: number;
  doneCount: number;
}

const PLAT_LABEL = { wpp: 'WhatsApp', insta: 'Instagram', msg: 'Messenger' } as const;

export function byPlatform(data: AppData): PlatformStat[] {
  const lastColId = data.cols.length ? data.cols[data.cols.length - 1].id : null;
  const plats: PlatformStat['plat'][] = ['wpp', 'insta', 'msg'];
  return plats.map(plat => {
    const cardsWith = data.cards.filter(c => (c.plat || []).includes(plat));
    const done = lastColId ? cardsWith.filter(c => c.cid === lastColId) : [];
    return { plat, label: PLAT_LABEL[plat], count: cardsWith.length, doneCount: done.length };
  });
}

export interface TrendComparison {
  current: number;
  previous: number;
  deltaPct: number; // -100..+999
}

function trendDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export function weekOverWeek(data: AppData): {
  total: TrendComparison;
  completed: TrendComparison;
  created: TrendComparison;
} {
  if (!data.activity) {
    return {
      total: { current: 0, previous: 0, deltaPct: 0 },
      completed: { current: 0, previous: 0, deltaPct: 0 },
      created: { current: 0, previous: 0, deltaPct: 0 }
    };
  }
  const now = new Date();
  const sumRange = (daysAgoStart: number, daysAgoEnd: number) => {
    let total = 0, completed = 0, created = 0;
    for (let i = daysAgoEnd; i < daysAgoStart; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = todayStr(d);
      const a = data.activity?.[key];
      if (a) { total += a.total; completed += a.cardsCompleted; created += a.cardsCreated; }
    }
    return { total, completed, created };
  };
  const curr = sumRange(7, 0);
  const prev = sumRange(14, 7);
  return {
    total: { current: curr.total, previous: prev.total, deltaPct: trendDelta(curr.total, prev.total) },
    completed: { current: curr.completed, previous: prev.completed, deltaPct: trendDelta(curr.completed, prev.completed) },
    created: { current: curr.created, previous: prev.created, deltaPct: trendDelta(curr.created, prev.created) }
  };
}

export interface Bottleneck {
  colName: string;
  count: number;
  avgDays: number;
  severity: 'low' | 'medium' | 'high';
}

export function detectBottlenecks(data: AppData): Bottleneck[] {
  const stages = avgTimeInColumns(data);
  // Bottleneck = column with avgDays > 7 AND count > 2 (skip last col which is "Concluído")
  const lastColIdx = data.cols.length - 1;
  return stages
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== lastColIdx && s.avgDaysFromCreation > 5 && s.count >= 2)
    .map(({ s }) => ({
      colName: s.colName,
      count: s.count,
      avgDays: s.avgDaysFromCreation,
      severity: s.avgDaysFromCreation > 14 ? 'high' as const : s.avgDaysFromCreation > 8 ? 'medium' as const : 'low' as const
    }))
    .sort((a, b) => b.avgDays - a.avgDays);
}

export { aggregate };

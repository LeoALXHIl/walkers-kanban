import type { AppData } from '@/types';
import { aggregate, todayStr } from './streak';

export type AchievementCategory = 'streak' | 'cards' | 'social' | 'time' | 'variety' | 'special';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  // Returns true if the achievement is currently met by the data
  check: (data: AppData) => boolean;
}

// Map of achievement id -> unlock timestamp (ms). Stored in AppData.achievements.
export type AchievementMap = Record<string, number>;

const lastColId = (data: AppData) => data.cols.length ? data.cols[data.cols.length - 1].id : null;
const completedCount = (data: AppData) => {
  const id = lastColId(data);
  return id ? data.cards.filter(c => c.cid === id).length : 0;
};

function uniqueColors(data: AppData): number {
  return new Set(data.cards.map(c => c.color || '#7c5cfc')).size;
}

function totalComments(data: AppData): number {
  return data.cards.reduce((acc, c) => acc + (c.comments?.length || 0), 0);
}

function maxCompletedInOneDay(data: AppData): number {
  if (!data.activity) return 0;
  let max = 0;
  for (const a of Object.values(data.activity)) {
    if (a.cardsCompleted > max) max = a.cardsCompleted;
  }
  return max;
}

function hasCompletedAtHour(data: AppData, minH: number, maxH: number): boolean {
  // Heuristic: check if any card ts (creation) falls in range AND that card is in the last col.
  // Cards don't track completion time individually, so this is best-effort.
  const finalId = lastColId(data);
  if (!finalId) return false;
  return data.cards.some(c => {
    if (c.cid !== finalId || !c.ts) return false;
    const h = new Date(c.ts).getHours();
    return h >= minH && h <= maxH;
  });
}

function hasCompletedWeekend(data: AppData): boolean {
  const finalId = lastColId(data);
  if (!finalId) return false;
  return data.cards.some(c => {
    if (c.cid !== finalId || !c.ts) return false;
    const day = new Date(c.ts).getDay();
    return day === 0 || day === 6;
  });
}

function noOverdue30d(data: AppData): boolean {
  // Met if user has activity in last 30d AND no card is currently overdue
  const stats = aggregate(data, 30);
  if (stats.activeDays < 5) return false;
  const today = todayStr();
  return !data.cards.some(c => c.due && c.due < today && c.cid !== lastColId(data));
}

function boardClean(data: AppData): boolean {
  // No overdue cards AND at least 3 cards exist
  if (data.cards.length < 3) return false;
  const today = todayStr();
  return !data.cards.some(c => c.due && c.due < today && c.cid !== lastColId(data));
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ─── Cards completed
  { id: 'first_done', name: 'Primeiro card', description: 'Concluiu seu primeiro card', emoji: '🎯', category: 'cards',
    check: d => completedCount(d) >= 1 },
  { id: 'ten_done', name: 'Implementador', description: '10 cards concluídos', emoji: '🚀', category: 'cards',
    check: d => completedCount(d) >= 10 },
  { id: 'fifty_done', name: 'Maratonista', description: '50 cards concluídos', emoji: '🏃', category: 'cards',
    check: d => completedCount(d) >= 50 },
  { id: 'hundred_done', name: 'Centena', description: '100 cards concluídos', emoji: '💪', category: 'cards',
    check: d => completedCount(d) >= 100 },
  { id: 'thousand_done', name: 'Lenda', description: '1.000 cards concluídos', emoji: '🏆', category: 'cards',
    check: d => completedCount(d) >= 1000 },

  // ─── Velocidade
  { id: 'speed_3', name: 'Trio', description: '3 cards concluídos no mesmo dia', emoji: '🎉', category: 'cards',
    check: d => maxCompletedInOneDay(d) >= 3 },
  { id: 'speed_5', name: 'Velocista', description: '5 cards concluídos no mesmo dia', emoji: '⚡', category: 'cards',
    check: d => maxCompletedInOneDay(d) >= 5 },
  { id: 'speed_10', name: 'Furacão', description: '10 cards concluídos no mesmo dia', emoji: '🌪️', category: 'cards',
    check: d => maxCompletedInOneDay(d) >= 10 },

  // ─── Streak
  { id: 'streak_3', name: 'Em chamas', description: '3 dias seguidos no Walkers', emoji: '🔥', category: 'streak',
    check: d => (d.streak?.longest || 0) >= 3 },
  { id: 'streak_7', name: 'Pegando fogo', description: '7 dias seguidos', emoji: '🔥🔥', category: 'streak',
    check: d => (d.streak?.longest || 0) >= 7 },
  { id: 'streak_30', name: 'Disciplinado', description: '30 dias seguidos', emoji: '⚜️', category: 'streak',
    check: d => (d.streak?.longest || 0) >= 30 },
  { id: 'streak_100', name: 'Lendário', description: '100 dias seguidos', emoji: '👑', category: 'streak',
    check: d => (d.streak?.longest || 0) >= 100 },
  { id: 'streak_365', name: 'Imortal', description: '365 dias seguidos', emoji: '🌟', category: 'streak',
    check: d => (d.streak?.longest || 0) >= 365 },

  // ─── Cards criados
  { id: 'first_created', name: 'Primeiro lance', description: 'Criou seu primeiro card', emoji: '✨', category: 'cards',
    check: d => d.cards.length >= 1 },
  { id: 'fifty_created', name: 'Organizador', description: '50 cards criados', emoji: '📋', category: 'cards',
    check: d => d.cards.length >= 50 },
  { id: 'twohundred_created', name: 'Curador', description: '200 cards criados', emoji: '🗂️', category: 'cards',
    check: d => d.cards.length >= 200 },

  // ─── Social / Comentários
  { id: 'first_comment', name: 'Comunicador', description: 'Primeiro comentário em um card', emoji: '💬', category: 'social',
    check: d => totalComments(d) >= 1 },
  { id: 'ten_comments', name: 'Documentador', description: '10 comentários no total', emoji: '📝', category: 'social',
    check: d => totalComments(d) >= 10 },
  { id: 'hundred_comments', name: 'Cronista', description: '100 comentários no total', emoji: '📖', category: 'social',
    check: d => totalComments(d) >= 100 },

  // ─── Time-based
  { id: 'night_owl', name: 'Coruja', description: 'Concluiu um card depois das 22h', emoji: '🌙', category: 'time',
    check: d => hasCompletedAtHour(d, 22, 23) },
  { id: 'early_bird', name: 'Madrugador', description: 'Concluiu um card antes das 7h', emoji: '🐦', category: 'time',
    check: d => hasCompletedAtHour(d, 0, 6) },
  { id: 'weekend_warrior', name: 'Guerreiro do FDS', description: 'Concluiu um card no sábado/domingo', emoji: '🌅', category: 'time',
    check: d => hasCompletedWeekend(d) },

  // ─── Variety
  { id: 'colorful', name: 'Colorido', description: 'Cards de 5+ cores diferentes', emoji: '🎨', category: 'variety',
    check: d => uniqueColors(d) >= 5 },
  { id: 'tagged', name: 'Etiquetador', description: 'Criou 5+ etiquetas', emoji: '🏷️', category: 'variety',
    check: d => d.tags.length >= 5 },

  // ─── Special
  { id: 'clean_board', name: 'Mesa limpa', description: 'Board com 3+ cards e nenhum atrasado', emoji: '🧹', category: 'special',
    check: d => boardClean(d) },
  { id: 'no_overdue_30d', name: 'Sniper', description: '30 dias sem cards atrasados', emoji: '🎯', category: 'special',
    check: d => noOverdue30d(d) }
];

export interface UnlockedAchievement {
  def: AchievementDef;
  unlockedAt: number;
}

// Compares current data against existing achievements map; returns the IDs newly unlocked
// AND mutates the map to include them. Returns empty array if nothing new.
export function checkAchievements(data: AppData): UnlockedAchievement[] {
  if (!data.achievements) data.achievements = {};
  const now = Date.now();
  const newlyUnlocked: UnlockedAchievement[] = [];
  for (const def of ACHIEVEMENTS) {
    if (data.achievements[def.id]) continue; // already unlocked
    try {
      if (def.check(data)) {
        data.achievements[def.id] = now;
        newlyUnlocked.push({ def, unlockedAt: now });
      }
    } catch (e) {
      console.warn('Achievement check failed for', def.id, e);
    }
  }
  return newlyUnlocked;
}

export function unlockedCount(data: AppData): number {
  return data.achievements ? Object.keys(data.achievements).length : 0;
}

export function totalAchievements(): number {
  return ACHIEVEMENTS.length;
}

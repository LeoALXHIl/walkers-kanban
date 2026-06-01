import type { AppData, Card } from '@/types';

export const genId = () => '_' + Math.random().toString(36).slice(2, 9);

export const DEFAULT_BOARD_ID = 'b_default';

export const DEFAULT_DATA: AppData = {
  version: 3,
  cols: [
    { id: 'c1', name: 'A Iniciar', color: '#3b82f6', boardId: DEFAULT_BOARD_ID },
    { id: 'c2', name: 'Em Implementação', color: '#a855f7', boardId: DEFAULT_BOARD_ID },
    { id: 'c3', name: 'Aguardando Cliente', color: '#f59e0b', boardId: DEFAULT_BOARD_ID },
    { id: 'c4', name: 'Concluído', color: '#22c55e', boardId: DEFAULT_BOARD_ID }
  ],
  cards: [],
  members: [],
  tags: [],
  boards: [{
    id: DEFAULT_BOARD_ID,
    name: 'Implementações',
    emoji: '🚀',
    color: '#7c5cfc',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }],
  customFields: [],
  activeBoardId: DEFAULT_BOARD_ID
};

export function emptyData(): AppData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

export function migrateData(d: Partial<AppData>): AppData {
  const data = d as AppData;
  if (!data.version) data.version = 3;
  if (!data.members) data.members = [];
  if (!data.tags) data.tags = [];
  if (!data.cols || !data.cols.length) data.cols = JSON.parse(JSON.stringify(DEFAULT_DATA.cols));
  if (!data.cards) data.cards = [];
  if (!data.streak) data.streak = { current: 0, longest: 0, lastActivityDay: null, startedAt: null, lastWrapShownWeek: null };
  if (!data.activity) data.activity = {};
  if (!data.achievements) data.achievements = {};
  if (!data.clientProfiles) data.clientProfiles = {};
  if (!data.integrations) data.integrations = { webhooks: [] };
  if (!data.templates) data.templates = [];

  // ─── Multi-boards migration ────────────────────────────────
  if (!data.boards || !data.boards.length) {
    data.boards = [{
      id: DEFAULT_BOARD_ID,
      name: 'Implementações',
      emoji: '🚀',
      color: '#7c5cfc',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];
  }
  if (!data.activeBoardId || !data.boards.find(b => b.id === data.activeBoardId)) {
    data.activeBoardId = data.boards[0].id;
  }
  // Ensure all existing cols/cards belong to a board
  const defaultBid = data.boards[0].id;
  data.cols.forEach((col) => { if (!col.boardId) col.boardId = defaultBid; });

  if (!data.customFields) data.customFields = [];
  if (!data.goals) data.goals = [];
  if (!data.sprints) data.sprints = [];

  // ─── v4.20: Migrate ClientProfile.tags (string[]) → tagIds (refs to data.tags) ───
  if (data.clientProfiles) {
    const palette = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#38bdf8','#10b981','#a855f7','#f97316'];
    Object.values(data.clientProfiles).forEach(profile => {
      if (profile.tagIds) return; // already migrated
      const legacy = (profile.tags || []).filter(Boolean);
      const ids: string[] = [];
      legacy.forEach(name => {
        const lowered = name.toLowerCase().trim();
        let tag = data.tags.find(t => t.name.toLowerCase() === lowered);
        if (!tag) {
          tag = { id: genId(), name: name.trim(), color: palette[data.tags.length % palette.length] };
          data.tags.push(tag);
        }
        ids.push(tag.id);
      });
      profile.tagIds = ids;
    });
  }

  data.cards.forEach((c: Partial<Card>) => {
    if (c.desc === undefined) c.desc = '';
    if (c.subtasks === undefined) c.subtasks = [];
    if (c.due === undefined) c.due = null;
    if (c.tagIds === undefined) c.tagIds = [];
    if (c.assignee === undefined) c.assignee = null;
    if (c.attachments === undefined) c.attachments = [];
    if (c.comments === undefined) c.comments = [];
    if (c.note === undefined) c.note = '';
    if (c.plat === undefined) c.plat = [];
    if (c.prio === undefined) c.prio = 'med';
    if (c.color === undefined) c.color = '#7c5cfc';
    if (c.ts === undefined) c.ts = Date.now();
    if (c.archived === undefined) c.archived = false;
    if (c.pinned === undefined) c.pinned = false;
    if (!c.boardId) c.boardId = defaultBid;
    if (!c.customValues) c.customValues = {};
  });
  return data;
}

export function fmt(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function fmtTime(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Relative time string: "agora", "há 5min", "há 2h", "há 3d", "há 2sem", "há 3mês", "há 1a"
export function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 0) {
    const future = -diff;
    if (future < 86400_000) return 'em breve';
    return 'em ' + Math.round(future / 86400_000) + 'd';
  }
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  if (diff < min) return 'agora';
  if (diff < hr) return 'há ' + Math.floor(diff / min) + 'min';
  if (diff < day) return 'há ' + Math.floor(diff / hr) + 'h';
  if (diff < week) return 'há ' + Math.floor(diff / day) + 'd';
  if (diff < month) return 'há ' + Math.floor(diff / week) + 'sem';
  if (diff < year) return 'há ' + Math.floor(diff / month) + 'mês';
  return 'há ' + Math.floor(diff / year) + 'a';
}

export interface DueInfo { cls: 'due-ok' | 'due-today' | 'due-late'; label: string; }
export function dueInfo(due: string | null | undefined): DueInfo | null {
  if (!due) return null;
  const d = new Date(due + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  let cls: DueInfo['cls'] = 'due-ok';
  let label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (diff < 0) { cls = 'due-late'; label = 'Atrasado · ' + label; }
  else if (diff === 0) { cls = 'due-today'; label = 'Hoje'; }
  else if (diff === 1) { cls = 'due-ok'; label = 'Amanhã'; }
  return { cls, label };
}

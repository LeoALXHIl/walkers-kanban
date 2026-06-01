import { create } from 'zustand';
import { doc, getDoc, onSnapshot, setDoc, type DocumentReference, type Unsubscribe } from 'firebase/firestore';
import type { AppData, Card, Column, Subtask, SubtaskStatus, Attachment, Comment, MutationKind, ClientProfile, WebhookConfig, CardTemplate, TemplateSubtask, Board, CustomField, CustomFieldType, Goal, GoalType, GoalStatus, Sprint, SprintStatus } from '@/types';
import { clientKey } from '@/services/clients';
import { auth, db, userKanbanDoc, workspaceDataDoc } from '@/services/firebase';
import { ensureUserProfile, loadMyWorkspaces, migrateLegacyData, createWorkspace, loadWorkspace, setActiveWorkspace } from '@/services/workspaces';
import { DEFAULT_DATA, emptyData, genId, migrateData } from '@/services/storage';
import { useUI } from './ui';
import { useNotifications } from './notifications';
import { confetti } from '@/services/confetti';
import { pruneActivity, recordActivity } from '@/services/streak';
import { checkAchievements } from '@/services/achievements';
import { emit } from '@/services/events';
import { captureSnapshot } from '@/services/flowSnapshots';

interface DataState {
  data: AppData;
  fbConnected: boolean;
  kanbanDoc: DocumentReference | null;
  unsub: Unsubscribe | null;
  ignoreNextSnapshot: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  // UX-4 undo stack — keeps last 30 snapshots of `data` to allow Ctrl+Z
  undoStack: AppData[];
  // mutations
  apply: (mutator: (d: AppData) => void, kind?: MutationKind) => void;
  undo: () => boolean;
  // flow
  bootForUser: (uid: string) => Promise<void>;
  teardown: () => Promise<void>;
  flushPending: () => void;
}

async function saveLocal(data: AppData) {
  try { await window.walkersAPI.saveData(data); } catch (e) { console.error(e); }
}

// Best-effort webhook delivery — fire-and-forget. Errors logged, not surfaced.
type WebhookEvent = 'card.created' | 'card.moved' | 'card.completed' | 'card.deleted';

const EVT_META: Record<WebhookEvent, { emoji: string; title: string; color: number }> = {
  'card.created':   { emoji: '✨', title: 'Card criado',    color: 0x7c5cfc },
  'card.moved':     { emoji: '🔀', title: 'Card movido',    color: 0x38bdf8 },
  'card.completed': { emoji: '✅', title: 'Card concluído', color: 0x22c55e },
  'card.deleted':   { emoji: '🗑️', title: 'Card removido',  color: 0xef4444 }
};

function formatForDiscord(event: WebhookEvent, payload: any): unknown {
  const meta = EVT_META[event];
  let description = `**${payload.name || '(sem nome)'}**`;
  if (event === 'card.moved' && payload.from && payload.to) {
    description += `\n${payload.from} → ${payload.to}`;
  } else if (event === 'card.completed' && payload.from) {
    description += `\nSaiu de: ${payload.from}`;
  }
  return {
    username: 'Walkers Kanban',
    embeds: [{
      title: `${meta.emoji} ${meta.title}`,
      description,
      color: meta.color,
      footer: { text: 'Walkers Kanban · walkers.app' },
      timestamp: new Date().toISOString()
    }]
  };
}

function formatForSlack(event: WebhookEvent, payload: any): unknown {
  const meta = EVT_META[event];
  let text = `${meta.emoji} *${meta.title}*: ${payload.name || '(sem nome)'}`;
  if (event === 'card.moved' && payload.from && payload.to) text += `\n${payload.from} → ${payload.to}`;
  return { text };
}

async function fireWebhooks(data: AppData, event: WebhookEvent, payload: any): Promise<void> {
  const hooks = data.integrations?.webhooks?.filter(w => w.enabled && w.events.includes(event)) || [];
  for (const w of hooks) {
    const isDiscord = /(^|\/\/)(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//i.test(w.url);
    const isSlack = /hooks\.slack\.com\//i.test(w.url);
    const body = isDiscord ? formatForDiscord(event, payload)
              : isSlack ? formatForSlack(event, payload)
              : { event, payload, ts: Date.now() }; // generic
    fetch(w.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => {
        const ws = useData.getState().data.integrations?.webhooks?.find(x => x.id === w.id);
        if (ws) { ws.lastTriggeredAt = Date.now(); ws.lastStatus = res.ok ? 'ok' : 'error'; }
      })
      .catch(() => {
        const ws = useData.getState().data.integrations?.webhooks?.find(x => x.id === w.id);
        if (ws) { ws.lastTriggeredAt = Date.now(); ws.lastStatus = 'error'; }
      });
  }
}

export const useData = create<DataState>((set, get) => ({
  data: emptyData(),
  fbConnected: false,
  kanbanDoc: null,
  unsub: null,
  ignoreNextSnapshot: false,
  saveTimer: null,
  undoStack: [],

  apply: (mutator, kind = 'other') => {
    const cur = get().data;
    const next: AppData = JSON.parse(JSON.stringify(cur));
    mutator(next);
    recordActivity(next, kind);
    pruneActivity(next);
    const newAchievements = checkAchievements(next);
    // UX-4: push previous state to undo stack (max 30 snapshots)
    const undoStack = [...get().undoStack, cur].slice(-30);
    set({ data: next, undoStack });
    // DV-3: capturar snapshot diário pro cumulative flow
    try { captureSnapshot(next); } catch {}
    // Save local immediately
    saveLocal(next);
    // Emit toasts AFTER state is committed so UI animations align
    if (newAchievements.length) {
      newAchievements.forEach(a => emit('achievement:unlocked', a));
    }
    // Debounce Firestore push
    const { fbConnected, kanbanDoc, saveTimer } = get();
    if (saveTimer) clearTimeout(saveTimer);
    if (!fbConnected || !kanbanDoc) return;
    const t = setTimeout(async () => {
      try {
        useUI.getState().setFbStatus('syncing', 'Sincronizando…');
        set({ ignoreNextSnapshot: true });
        await setDoc(kanbanDoc, get().data);
        useUI.getState().setFbStatus('ok', 'Firebase ✓ sincronizado');
        setTimeout(() => useUI.getState().setFbStatus('ok', 'Firebase ✓ conectado'), 2000);
      } catch (e: any) {
        useUI.getState().setFbStatus('error', 'Erro Firebase: ' + (e.message || 'falha'));
        set({ ignoreNextSnapshot: false });
      } finally {
        set({ saveTimer: null });
      }
    }, 300);
    set({ saveTimer: t });
  },

  undo: () => {
    const stack = get().undoStack;
    if (stack.length === 0) return false;
    const previous = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);
    set({ data: previous, undoStack: newStack });
    saveLocal(previous);
    // Schedule firestore sync of restored state
    const { fbConnected, kanbanDoc } = get();
    if (fbConnected && kanbanDoc) {
      set({ ignoreNextSnapshot: true });
      setDoc(kanbanDoc, previous).catch(() => set({ ignoreNextSnapshot: false }));
    }
    return true;
  },

  flushPending: () => {
    const { saveTimer, fbConnected, kanbanDoc, data } = get();
    if (saveTimer) { clearTimeout(saveTimer); set({ saveTimer: null }); }
    if (fbConnected && kanbanDoc) {
      // fire-and-forget
      try { setDoc(kanbanDoc, data); } catch {}
    }
  },

  bootForUser: async (uid) => {
    // Cancel any prior subscription (StrictMode double-invoke / user switch)
    const { unsub: prevUnsub, saveTimer: prevTimer } = get();
    if (prevTimer) clearTimeout(prevTimer);
    if (prevUnsub) prevUnsub();
    set({ unsub: null, saveTimer: null });
    useUI.getState().setFbStatus('syncing', 'Conectando Firebase…');

    // ─── v4.19: Multi-workspace logic ───
    // 1. Ensure user has a profile doc
    // 2. If user has no workspaces, migrate legacy data into a new "Pessoal" workspace OR create empty one
    // 3. Use currentWorkspaceId to point to workspaces/{wsId}/kanban/main
    const fbUser = auth.currentUser;
    let docRef = userKanbanDoc(uid); // fallback to legacy

    if (fbUser) {
      try {
        const profile = await ensureUserProfile(fbUser);
        let wsId = profile.currentWorkspaceId;
        if (!profile.workspaceIds?.length) {
          // First time on multi-user version — migrate legacy data if it exists
          const ws = await migrateLegacyData(fbUser);
          if (ws) {
            wsId = ws.id;
          } else {
            // No legacy — try local data
            const local = migrateData(await window.walkersAPI.loadData());
            if ((local.cards || []).length > 0) {
              const ok = confirm(`Encontramos ${local.cards.length} card(s) salvos localmente neste computador. Importar para um novo workspace?`);
              if (ok) {
                const ws2 = await createWorkspace(fbUser, 'Pessoal', '👤');
                wsId = ws2.id;
                await setDoc(workspaceDataDoc(ws2.id), local);
              }
            }
            if (!wsId) {
              const ws3 = await createWorkspace(fbUser, 'Pessoal', '👤');
              wsId = ws3.id;
            }
          }
        }
        if (!wsId || !(await loadWorkspace(wsId))) {
          // Fallback: pick first available workspace
          const all = await loadMyWorkspaces({ ...profile, workspaceIds: profile.workspaceIds || [] });
          if (all.length > 0) {
            wsId = all[0].id;
            await setActiveWorkspace(uid, wsId);
          }
        }
        if (wsId) {
          docRef = workspaceDataDoc(wsId);
        }
      } catch (e) {
        console.warn('[walkers] workspace setup failed, falling back to legacy', e);
      }
    }

    set({ kanbanDoc: docRef });
    try {
      const snap = await getDoc(docRef);
      let nextData: AppData;
      if (snap.exists()) {
        nextData = migrateData(snap.data() as AppData);
      } else {
        // First boot of a fresh workspace
        const local = migrateData(await window.walkersAPI.loadData());
        nextData = (local.cards || []).length > 0 && confirm(`Importar ${local.cards.length} card(s) do disco local?`)
          ? local : emptyData();
        nextData = migrateData(nextData);
        await setDoc(docRef, nextData);
      }
      await saveLocal(nextData);
      set({ data: nextData, fbConnected: true });
      useUI.getState().setFbStatus('ok', 'Firebase ✓ conectado');

      // Real-time subscription
      const unsub = onSnapshot(docRef, (snap) => {
        if (get().ignoreNextSnapshot) { set({ ignoreNextSnapshot: false }); return; }
        if (!snap.exists()) return;
        const remote = migrateData(snap.data() as AppData);
        const prev = get().data;
        const oldIds = new Set(prev.cards.map(c => c.id));
        const newIds = new Set(remote.cards.map(c => c.id));
        const added = remote.cards.filter(c => !oldIds.has(c.id));
        const removed = prev.cards.filter(c => !newIds.has(c.id));
        const moved = remote.cards.filter(nc => {
          const oc = prev.cards.find(x => x.id === nc.id);
          return !!(oc && oc.cid !== nc.cid);
        });
        set({ data: remote });
        saveLocal(remote);
        if (added.length || removed.length || moved.length) {
          const parts: string[] = [];
          if (added.length) parts.push(`${added.length} novo${added.length > 1 ? 's' : ''}`);
          if (moved.length) parts.push(`${moved.length} movido${moved.length > 1 ? 's' : ''}`);
          if (removed.length) parts.push(`${removed.length} removido${removed.length > 1 ? 's' : ''}`);
          useNotifications.getState().add({
            type: 'sync',
            icon: '🔄',
            title: 'Sincronizado de outro dispositivo',
            sub: parts.join(' · '),
            ts: Date.now()
          });
        }
      });
      set({ unsub });
    } catch (e: any) {
      console.error('Firebase boot failed', e);
      useUI.getState().setFbStatus('error', 'Erro: ' + (e.message || 'falha'));
      set({ fbConnected: false });
    }
  },

  teardown: async () => {
    const { unsub, saveTimer } = get();
    if (saveTimer) clearTimeout(saveTimer);
    if (unsub) unsub();
    set({ unsub: null, kanbanDoc: null, fbConnected: false, saveTimer: null, ignoreNextSnapshot: false });
    const empty = emptyData();
    set({ data: empty });
    try { await window.walkersAPI.saveData(empty); } catch {}
  }
}));

// ─── High-level mutation helpers (curried via apply) ─────────────
function lastColId(): string | null {
  const cols = useData.getState().data.cols;
  return cols.length ? cols[cols.length - 1].id : null;
}

export function addCard(card: Card): void {
  useData.getState().apply((d) => {
    if (!card.boardId) card.boardId = d.activeBoardId;
    if (!card.customValues) card.customValues = {};
    d.cards.push(card);
  }, 'create');
  fireWebhooks(useData.getState().data, 'card.created', { id: card.id, name: card.name, cid: card.cid });
}

export function deleteCard(id: string): void {
  const card = useData.getState().data.cards.find(c => c.id === id);
  useData.getState().apply((d) => { d.cards = d.cards.filter(c => c.id !== id); }, 'other');
  if (card) fireWebhooks(useData.getState().data, 'card.deleted', { id: card.id, name: card.name });
}

export function archiveCard(id: string, archived = true): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === id);
    if (!c) return;
    c.archived = archived;
    c.archivedAt = archived ? Date.now() : undefined;
  }, 'other');
}

export function toggleStarCard(id: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === id);
    if (!c) return;
    c.starred = !c.starred;
  }, 'other');
}

export function snoozeCard(id: string, until: number | null): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === id);
    if (!c) return;
    c.snoozedUntil = until || undefined;
  }, 'other');
}

export function togglePinCard(id: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === id);
    if (!c) return;
    c.pinned = !c.pinned;
  }, 'other');
}

export function duplicateCard(id: string): string | null {
  const orig = useData.getState().data.cards.find(c => c.id === id);
  if (!orig) return null;
  const newId = genId();
  const copy: Card = {
    ...orig,
    id: newId,
    name: orig.name + ' (cópia)',
    ts: Date.now(),
    archived: false,
    archivedAt: undefined,
    pinned: false,
    subtasks: orig.subtasks.map(s => ({ id: genId(), text: s.text, done: false, assignee: s.assignee, due: s.due, note: s.note, status: 'todo' as const })),
    comments: [],
    order: undefined
  };
  useData.getState().apply((d) => { d.cards.push(copy); }, 'create');
  fireWebhooks(useData.getState().data, 'card.created', { id: copy.id, name: copy.name, cid: copy.cid });
  return newId;
}

export function reorderCardInColumn(cardId: string, beforeCardId: string | null): void {
  useData.getState().apply((d) => {
    const card = d.cards.find(c => c.id === cardId);
    if (!card) return;
    // Get all cards in same column except this one, sorted by current order
    const colCards = d.cards.filter(c => c.cid === card.cid && c.id !== cardId);
    colCards.sort((a, b) => (a.order ?? a.ts ?? 0) - (b.order ?? b.ts ?? 0));
    // Find insertion index
    let insertIdx = colCards.length;
    if (beforeCardId) {
      const idx = colCards.findIndex(c => c.id === beforeCardId);
      if (idx >= 0) insertIdx = idx;
    }
    // Reassign order to all cards in column
    colCards.splice(insertIdx, 0, card);
    colCards.forEach((c, i) => {
      const target = d.cards.find(x => x.id === c.id);
      if (target) target.order = i * 1000;
    });
  }, 'other');
}

export function updateCard(id: string, patch: Partial<Card>): void {
  const prev = useData.getState().data.cards.find(c => c.id === id);
  const prevCid = prev?.cid;
  const finalId = lastColId();
  const reachedLast = !!(patch.cid && finalId && prevCid !== finalId && patch.cid === finalId);
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    if (patch.assignee && !d.members.includes(patch.assignee)) {
      d.members.push(patch.assignee);
    }
  }, reachedLast ? 'complete' : (patch.cid ? 'move' : 'other'));
  // Confetti when reaching last column
  if (reachedLast) confetti();
}

export function moveCard(id: string, targetCid: string): { moved: boolean; oldName: string | null; newName: string | null; reachedLast: boolean } {
  const state = useData.getState();
  const card = state.data.cards.find(c => c.id === id);
  if (!card) return { moved: false, oldName: null, newName: null, reachedLast: false };
  const oldCol = state.data.cols.find(c => c.id === card.cid);
  const newCol = state.data.cols.find(c => c.id === targetCid);
  const finalId = lastColId();
  const reachedLast = !!finalId && card.cid !== finalId && targetCid === finalId;
  const moved = card.cid !== targetCid;
  if (moved) {
    state.apply((d) => {
      const c = d.cards.find(x => x.id === id);
      if (c) c.cid = targetCid;
    }, reachedLast ? 'complete' : 'move');
    if (reachedLast) confetti();
    const payload = {
      id: card.id, name: card.name,
      from: oldCol?.name, to: newCol?.name, completed: reachedLast
    };
    fireWebhooks(useData.getState().data, reachedLast ? 'card.completed' : 'card.moved', payload);
  }
  return {
    moved,
    oldName: oldCol?.name || null,
    newName: newCol?.name || null,
    reachedLast
  };
}

export function addColumn(name: string, color: string): void {
  useData.getState().apply((d) => {
    d.cols.push({ id: genId(), name, color, boardId: d.activeBoardId });
  });
}

export function updateColumn(id: string, patch: Partial<Column>): void {
  useData.getState().apply((d) => {
    const c = d.cols.find(x => x.id === id);
    if (c) Object.assign(c, patch);
  });
}

export function deleteColumn(id: string): { movedCount: number; name: string } {
  const state = useData.getState();
  const col = state.data.cols.find(c => c.id === id);
  const sameBoard = state.data.cols.filter(c => c.boardId === col?.boardId);
  const fallback = sameBoard.find(c => c.id !== id);
  let movedCount = 0;
  state.apply((d) => {
    if (fallback) {
      d.cards.forEach(c => { if (c.cid === id) { c.cid = fallback.id; movedCount++; } });
    } else {
      d.cards = d.cards.filter(c => c.cid !== id);
    }
    d.cols = d.cols.filter(c => c.id !== id);
  });
  return { movedCount, name: col?.name || '—' };
}

export function reorderColumns(fromId: string, toId: string): void {
  if (fromId === toId) return;
  useData.getState().apply((d) => {
    const fi = d.cols.findIndex(c => c.id === fromId);
    const ti = d.cols.findIndex(c => c.id === toId);
    if (fi < 0 || ti < 0) return;
    const [col] = d.cols.splice(fi, 1);
    d.cols.splice(ti, 0, col);
  });
}

export interface SubtaskOpts {
  assignee?: string | null;
  due?: string | null;
  note?: string;
  status?: SubtaskStatus;
}

export function addSubtask(cardId: string, text: string, opts?: SubtaskOpts): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    const status = opts?.status || 'todo';
    c.subtasks.push({
      id: genId(),
      text,
      done: status === 'done',
      assignee: opts?.assignee ?? null,
      due: opts?.due ?? null,
      note: opts?.note,
      status
    });
  }, 'subtask');
}

export function toggleSubtask(cardId: string, subId: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    const s = c.subtasks.find(x => x.id === subId);
    if (s) {
      s.done = !s.done;
      s.status = s.done ? 'done' : 'todo';
    }
  }, 'subtask');
}

// Set explicit status; keeps `done` flag in sync for backward compat.
export function setSubtaskStatus(cardId: string, subId: string, status: SubtaskStatus): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    const s = c.subtasks.find(x => x.id === subId);
    if (s) {
      s.status = status;
      s.done = status === 'done';
    }
  }, 'subtask');
}

export function updateSubtask(cardId: string, subId: string, patch: Partial<Subtask>): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    const s = c.subtasks.find(x => x.id === subId);
    if (!s) return;
    Object.assign(s, patch);
    if (patch.status !== undefined) s.done = patch.status === 'done';
    if (patch.done !== undefined && patch.status === undefined) s.status = patch.done ? 'done' : 'todo';
  }, 'subtask');
}

export function deleteSubtask(cardId: string, subId: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    c.subtasks = c.subtasks.filter(x => x.id !== subId);
  }, 'subtask');
}

export function addAttachment(cardId: string, title: string, url: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    c.attachments.push({ id: genId(), title: title || url, url });
  });
}

export function deleteAttachment(cardId: string, attId: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    c.attachments = c.attachments.filter(a => a.id !== attId);
  });
}

export function addComment(cardId: string, text: string, author: string): Comment {
  const cm: Comment = { id: genId(), text, author, ts: Date.now() };
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    c.comments.push(cm);
  }, 'comment');
  return cm;
}

export function addTagToCard(cardId: string, tagName: string, paletteIndex: number): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    let tag = d.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (!tag) {
      const palette = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#38bdf8','#10b981'];
      tag = { id: genId(), name: tagName, color: palette[paletteIndex % palette.length] };
      d.tags.push(tag);
    }
    if (!c.tagIds.includes(tag.id)) c.tagIds.push(tag.id);
  });
}

export function removeTagFromCard(cardId: string, tagId: string): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    c.tagIds = c.tagIds.filter(t => t !== tagId);
  });
}

export type { Card, Column, Subtask, Attachment, Comment };

// ─── Client profile mutations ───────────────────────────────────
export function updateClientProfile(displayName: string, patch: Partial<ClientProfile>): void {
  useData.getState().apply((d) => {
    if (!d.clientProfiles) d.clientProfiles = {};
    const key = clientKey(displayName);
    const existing = d.clientProfiles[key];
    if (existing) {
      Object.assign(existing, patch, { updatedAt: Date.now() });
    } else {
      d.clientProfiles[key] = {
        key,
        displayName: displayName.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch
      };
    }
  }, 'other');
}

export function addTagToClient(clientKey: string, tagName: string, paletteIndex: number = 0): void {
  const palette = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#38bdf8','#10b981','#a855f7','#f97316'];
  useData.getState().apply((d) => {
    const profile = d.clientProfiles?.[clientKey];
    if (!profile) return;
    const lowered = tagName.toLowerCase().trim();
    if (!lowered) return;
    let tag = d.tags.find(t => t.name.toLowerCase() === lowered);
    if (!tag) {
      tag = { id: genId(), name: tagName.trim(), color: palette[(paletteIndex || d.tags.length) % palette.length] };
      d.tags.push(tag);
    }
    if (!profile.tagIds) profile.tagIds = [];
    if (!profile.tagIds.includes(tag.id)) profile.tagIds.push(tag.id);
    profile.updatedAt = Date.now();
  }, 'other');
}

export function removeTagFromClient(clientKey: string, tagId: string): void {
  useData.getState().apply((d) => {
    const profile = d.clientProfiles?.[clientKey];
    if (!profile || !profile.tagIds) return;
    profile.tagIds = profile.tagIds.filter(id => id !== tagId);
    profile.updatedAt = Date.now();
  }, 'other');
}

export function archiveClient(key: string, archived = true): void {
  useData.getState().apply((d) => {
    if (!d.clientProfiles) d.clientProfiles = {};
    if (d.clientProfiles[key]) {
      d.clientProfiles[key].archived = archived;
      d.clientProfiles[key].updatedAt = Date.now();
    }
  }, 'other');
}

// ─── Webhook mutations ───────────────────────────────────────────
export function addWebhook(cfg: Omit<WebhookConfig, 'id' | 'createdAt'>): void {
  useData.getState().apply((d) => {
    if (!d.integrations) d.integrations = { webhooks: [] };
    if (!d.integrations.webhooks) d.integrations.webhooks = [];
    d.integrations.webhooks.push({
      ...cfg,
      id: genId(),
      createdAt: Date.now()
    });
  }, 'other');
}

export function updateWebhook(id: string, patch: Partial<WebhookConfig>): void {
  useData.getState().apply((d) => {
    const w = d.integrations?.webhooks?.find(x => x.id === id);
    if (w) Object.assign(w, patch);
  }, 'other');
}

export function deleteWebhook(id: string): void {
  useData.getState().apply((d) => {
    if (d.integrations?.webhooks) {
      d.integrations.webhooks = d.integrations.webhooks.filter(x => x.id !== id);
    }
  }, 'other');
}

export function updateIntegrationsConfig(patch: Partial<NonNullable<AppData['integrations']>>): void {
  useData.getState().apply((d) => {
    if (!d.integrations) d.integrations = { webhooks: [] };
    Object.assign(d.integrations, patch);
  }, 'other');
}

// ─── Template mutations ───────────────────────────────────────────
export function addTemplate(t: Omit<CardTemplate, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): string {
  const id = genId();
  useData.getState().apply((d) => {
    if (!d.templates) d.templates = [];
    d.templates.push({
      ...t,
      id,
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }, 'other');
  return id;
}

export function updateTemplate(id: string, patch: Partial<CardTemplate>): void {
  useData.getState().apply((d) => {
    const t = d.templates?.find(x => x.id === id);
    if (t) Object.assign(t, patch, { updatedAt: Date.now() });
  }, 'other');
}

export function deleteTemplate(id: string): void {
  useData.getState().apply((d) => {
    if (d.templates) d.templates = d.templates.filter(t => t.id !== id);
  }, 'other');
}

export function incrementTemplateUseCount(id: string): void {
  useData.getState().apply((d) => {
    const t = d.templates?.find(x => x.id === id);
    if (t) t.useCount = (t.useCount || 0) + 1;
  }, 'other');
}

// Build a Card from a template + a client name. Resolves tag names → IDs (creates tags if needed).
export function buildCardFromTemplate(template: CardTemplate, clientName: string, columnId?: string): Card {
  const data = useData.getState().data;
  const tagIds: string[] = [];

  // Resolve tag names → ids (will be persisted later when we apply the mutation)
  const palette = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#38bdf8','#10b981'];
  if (template.defaults.tagNames) {
    template.defaults.tagNames.forEach((tn, idx) => {
      const existing = data.tags.find(t => t.name.toLowerCase() === tn.toLowerCase());
      if (existing) tagIds.push(existing.id);
      // If not existing, we'll need to create — handled in createCardFromTemplate below
    });
  }

  const cardName = (template.defaults.name || '').replace(/\{\{cliente\}\}/gi, clientName) || clientName;
  const cid = columnId || template.defaults.cid || data.cols[0]?.id || '';

  return {
    id: genId(),
    cid,
    name: cardName,
    plat: template.defaults.plat || [],
    prio: template.defaults.prio || 'med',
    color: template.defaults.color || '#7c5cfc',
    note: (template.defaults.note || '').replace(/\{\{cliente\}\}/gi, clientName),
    desc: (template.defaults.desc || '').replace(/\{\{cliente\}\}/gi, clientName),
    assignee: null,
    due: null,
    tagIds,
    subtasks: (template.defaults.subtasks || []).map(s => ({ id: genId(), text: s.text, done: false })),
    attachments: [],
    comments: [],
    ts: Date.now()
  };
}

// Create card from template AND persist (resolves tag names, increments useCount, fires webhook)
export function createCardFromTemplate(templateId: string, clientName: string, columnId?: string): Card | null {
  const state = useData.getState();
  const template = state.data.templates?.find(t => t.id === templateId);
  if (!template) return null;
  const card = buildCardFromTemplate(template, clientName, columnId);

  state.apply((d) => {
    // Ensure tags exist for tagNames in template
    const palette = ['#7c5cfc','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#38bdf8','#10b981'];
    const resolvedTagIds: string[] = [];
    (template.defaults.tagNames || []).forEach((tn, idx) => {
      let tag = d.tags.find(t => t.name.toLowerCase() === tn.toLowerCase());
      if (!tag) {
        tag = { id: genId(), name: tn, color: palette[d.tags.length % palette.length] };
        d.tags.push(tag);
      }
      resolvedTagIds.push(tag.id);
    });
    card.tagIds = resolvedTagIds;
    // Scope card to current active board (so it stays board-isolated)
    if (!card.boardId) card.boardId = d.activeBoardId;
    if (!card.customValues) card.customValues = {};
    d.cards.push(card);
    // Increment useCount on the template
    const t = d.templates?.find(x => x.id === templateId);
    if (t) t.useCount = (t.useCount || 0) + 1;
  }, 'create');

  fireWebhooks(useData.getState().data, 'card.created', { id: card.id, name: card.name, cid: card.cid, fromTemplate: template.name });
  return card;
}

// Save an existing card as a new template
export function saveCardAsTemplate(cardId: string, templateName: string, emoji?: string, description?: string): string | null {
  const card = useData.getState().data.cards.find(c => c.id === cardId);
  if (!card) return null;
  const data = useData.getState().data;
  // Resolve tagIds → names
  const tagNames = card.tagIds.map(tid => data.tags.find(t => t.id === tid)?.name).filter(Boolean) as string[];
  return addTemplate({
    name: templateName.trim(),
    emoji,
    description,
    defaults: {
      cid: card.cid,
      prio: card.prio,
      plat: [...card.plat],
      color: card.color,
      note: card.note,
      desc: card.desc,
      tagNames,
      subtasks: card.subtasks.map(s => ({ text: s.text }))
    }
  });
}

// ─── Multi-boards ────────────────────────────────────────────────
export function addBoard(name: string, emoji?: string, color?: string): string {
  const id = 'b_' + genId().slice(1);
  useData.getState().apply((d) => {
    if (!d.boards) d.boards = [];
    d.boards.push({
      id,
      name: name.trim(),
      emoji: emoji || '📋',
      color: color || '#7c5cfc',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    d.activeBoardId = id;
    // Seed with the same 4 default columns so the new board isn't empty
    const seed = [
      { name: 'A Iniciar', color: '#3b82f6' },
      { name: 'Em Implementação', color: '#a855f7' },
      { name: 'Aguardando Cliente', color: '#f59e0b' },
      { name: 'Concluído', color: '#22c55e' }
    ];
    seed.forEach(s => d.cols.push({ id: genId(), name: s.name, color: s.color, boardId: id }));
  }, 'other');
  return id;
}

export function updateBoard(id: string, patch: Partial<Board>): void {
  useData.getState().apply((d) => {
    const b = d.boards?.find(x => x.id === id);
    if (b) { Object.assign(b, patch); b.updatedAt = Date.now(); }
  }, 'other');
}

export function deleteBoard(id: string): { cardCount: number; colCount: number; name: string } {
  const state = useData.getState();
  const boards = state.data.boards || [];
  if (boards.length <= 1) return { cardCount: 0, colCount: 0, name: '' }; // never delete last board
  const board = boards.find(b => b.id === id);
  const colCount = state.data.cols.filter(c => c.boardId === id).length;
  const cardCount = state.data.cards.filter(c => c.boardId === id).length;
  state.apply((d) => {
    d.cols = d.cols.filter(c => c.boardId !== id);
    d.cards = d.cards.filter(c => c.boardId !== id);
    d.customFields = (d.customFields || []).filter(f => f.boardId !== id);
    d.boards = (d.boards || []).filter(b => b.id !== id);
    if (d.activeBoardId === id) d.activeBoardId = d.boards[0]?.id;
  }, 'other');
  return { cardCount, colCount, name: board?.name || '—' };
}

export function setActiveBoard(id: string): void {
  useData.getState().apply((d) => {
    if (d.boards?.some(b => b.id === id)) d.activeBoardId = id;
  }, 'other');
}

// ─── Custom Fields ───────────────────────────────────────────────
export function addCustomField(boardId: string, name: string, type: CustomFieldType, options?: string[]): string {
  const id = 'cf_' + genId().slice(1);
  useData.getState().apply((d) => {
    if (!d.customFields) d.customFields = [];
    const position = d.customFields.filter(f => f.boardId === boardId).length;
    d.customFields.push({
      id, boardId, name: name.trim(), type,
      options: type === 'select' ? (options || []) : undefined,
      position
    });
  }, 'other');
  return id;
}

export function updateCustomField(id: string, patch: Partial<CustomField>): void {
  useData.getState().apply((d) => {
    const f = d.customFields?.find(x => x.id === id);
    if (f) Object.assign(f, patch);
  }, 'other');
}

export function deleteCustomField(id: string): void {
  useData.getState().apply((d) => {
    d.customFields = (d.customFields || []).filter(f => f.id !== id);
    d.cards.forEach(c => { if (c.customValues) delete c.customValues[id]; });
  }, 'other');
}

export function setCardCustomValue(cardId: string, fieldId: string, value: string | number | null): void {
  useData.getState().apply((d) => {
    const c = d.cards.find(x => x.id === cardId);
    if (!c) return;
    if (!c.customValues) c.customValues = {};
    if (value === null || value === '' || value === undefined) {
      delete c.customValues[fieldId];
    } else {
      c.customValues[fieldId] = value;
    }
  }, 'other');
}

// ─── Goals ───────────────────────────────────────────────────────
export function addGoal(g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'status'>): string {
  const id = 'goal_' + genId().slice(1);
  useData.getState().apply((d) => {
    if (!d.goals) d.goals = [];
    d.goals.push({
      ...g,
      id,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }, 'other');
  return id;
}

export function updateGoal(id: string, patch: Partial<Goal>): void {
  useData.getState().apply((d) => {
    const g = d.goals?.find(x => x.id === id);
    if (g) { Object.assign(g, patch); g.updatedAt = Date.now(); }
  }, 'other');
}

export function deleteGoal(id: string): void {
  useData.getState().apply((d) => {
    d.goals = (d.goals || []).filter(g => g.id !== id);
  }, 'other');
}

export function linkCardToGoal(goalId: string, cardId: string): void {
  useData.getState().apply((d) => {
    const g = d.goals?.find(x => x.id === goalId);
    if (!g) return;
    if (!g.linkedCardIds) g.linkedCardIds = [];
    if (!g.linkedCardIds.includes(cardId)) g.linkedCardIds.push(cardId);
    g.updatedAt = Date.now();
  }, 'other');
}

export function unlinkCardFromGoal(goalId: string, cardId: string): void {
  useData.getState().apply((d) => {
    const g = d.goals?.find(x => x.id === goalId);
    if (!g || !g.linkedCardIds) return;
    g.linkedCardIds = g.linkedCardIds.filter(id => id !== cardId);
    g.updatedAt = Date.now();
  }, 'other');
}

// ─── Sprints ─────────────────────────────────────────────────────
export function addSprint(s: Omit<Sprint, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'cardIds'>): string {
  const id = 'sp_' + genId().slice(1);
  useData.getState().apply((d) => {
    if (!d.sprints) d.sprints = [];
    d.sprints.push({
      ...s,
      id,
      status: 'planning',
      cardIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }, 'other');
  return id;
}

export function updateSprint(id: string, patch: Partial<Sprint>): void {
  useData.getState().apply((d) => {
    const s = d.sprints?.find(x => x.id === id);
    if (s) { Object.assign(s, patch); s.updatedAt = Date.now(); }
  }, 'other');
}

export function deleteSprint(id: string): void {
  useData.getState().apply((d) => {
    d.sprints = (d.sprints || []).filter(s => s.id !== id);
    if (d.activeSprintId === id) d.activeSprintId = undefined;
  }, 'other');
}

export function addCardToSprint(sprintId: string, cardId: string): void {
  useData.getState().apply((d) => {
    const s = d.sprints?.find(x => x.id === sprintId);
    if (!s) return;
    if (!s.cardIds.includes(cardId)) s.cardIds.push(cardId);
    s.updatedAt = Date.now();
  }, 'other');
}

export function removeCardFromSprint(sprintId: string, cardId: string): void {
  useData.getState().apply((d) => {
    const s = d.sprints?.find(x => x.id === sprintId);
    if (!s) return;
    s.cardIds = s.cardIds.filter(id => id !== cardId);
    s.updatedAt = Date.now();
  }, 'other');
}

export function setActiveSprint(id: string | null): void {
  useData.getState().apply((d) => {
    d.activeSprintId = id || undefined;
  }, 'other');
}

export function startSprint(id: string): void {
  updateSprint(id, { status: 'active' });
  setActiveSprint(id);
}

export function completeSprint(id: string, retrospective?: string): void {
  updateSprint(id, { status: 'completed', retrospective });
  // If this was the active sprint, clear it
  const cur = useData.getState().data.activeSprintId;
  if (cur === id) setActiveSprint(null);
}

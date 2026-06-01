// Desktop reminders: avisa o usuário (notificação nativa do SO + inbox interno)
// sobre tarefas que vencem hoje / atrasadas e sobre novas atribuições a ele.
// Tudo dedup pra não spammar: vencimentos 1x por dia/item, atribuições 1x por item.
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import { useNotifications } from '@/store/notifications';
import { currentUserNames, isMine, resolveSubStatus } from './mytasks';

const DUE_KEY = 'walkers.dueNotified.v1';      // { date: 'YYYY-MM-DD', ids: string[] }
const ASSIGN_KEY = 'walkers.assignSeen.v1';    // string[]

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(due: string): number {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const d = new Date(due + 'T00:00:00').getTime();
  return Math.round((d - t0.getTime()) / 86400000);
}

// ─── dedup de vencimentos (reseta a cada novo dia) ───
function loadDueNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(DUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === todayStr() && Array.isArray(parsed.ids)) return new Set(parsed.ids);
    }
  } catch {}
  return new Set();
}
function saveDueNotified(ids: Set<string>) {
  try { localStorage.setItem(DUE_KEY, JSON.stringify({ date: todayStr(), ids: [...ids] })); } catch {}
}

// ─── dedup de atribuições (persistente; null = primeira execução) ───
function loadAssignSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(ASSIGN_KEY);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return new Set(arr); }
  } catch {}
  return null;
}
function saveAssignSeen(ids: Set<string>) {
  try { localStorage.setItem(ASSIGN_KEY, JSON.stringify([...ids])); } catch {}
}

function fire(title: string, body: string, cardId: string | undefined, icon: string, type: string) {
  try { window.walkersAPI?.showNotification(title, body); } catch {}
  try {
    useNotifications.getState().add({ type, icon, title, sub: body, ts: Date.now(), cardId });
  } catch {}
}

// Tarefas (cards + subtarefas) atribuídas a mim que vencem hoje ou estão atrasadas.
export function runDueReminders() {
  const user = useAuth.getState().user;
  if (!user) return;
  const data = useData.getState().data;
  const ws = useWorkspace.getState().currentWorkspace;
  const names = currentUserNames(user, ws);
  if (names.size === 0) return;

  const notified = loadDueNotified();
  let changed = false;

  for (const c of data.cards) {
    if (c.archived) continue;

    // Card-level
    if (c.due && isMine(c.assignee, names)) {
      const diff = daysUntil(c.due);
      if (diff <= 0) {
        const id = 'card:' + c.id + ':' + c.due;
        if (!notified.has(id)) {
          const overdue = diff < 0;
          fire(
            overdue ? '⚠️ Tarefa atrasada' : '📅 Vence hoje',
            c.name,
            c.id,
            overdue ? '⚠️' : '📅',
            'due'
          );
          notified.add(id); changed = true;
        }
      }
    }

    // Subtask-level
    for (const s of c.subtasks || []) {
      if (s.due && isMine(s.assignee, names) && resolveSubStatus(s) !== 'done') {
        const diff = daysUntil(s.due);
        if (diff <= 0) {
          const id = 'sub:' + s.id + ':' + s.due;
          if (!notified.has(id)) {
            const overdue = diff < 0;
            fire(
              overdue ? '⚠️ Subtarefa atrasada' : '📅 Subtarefa vence hoje',
              `${s.text} · ${c.name}`,
              c.id,
              overdue ? '⚠️' : '📅',
              'due'
            );
            notified.add(id); changed = true;
          }
        }
      }
    }
  }

  if (changed) saveDueNotified(notified);
}

// Avisa quando um card/subtarefa NOVO é atribuído a mim.
// Na primeira execução só faz o "seed" (sem notificar o que já existia).
export function runAssignmentChecks() {
  const user = useAuth.getState().user;
  if (!user) return;
  const data = useData.getState().data;
  const ws = useWorkspace.getState().currentWorkspace;
  const names = currentUserNames(user, ws);
  if (names.size === 0) return;

  const seen = loadAssignSeen();
  const firstRun = seen === null;
  const set = seen || new Set<string>();
  const newly: Array<{ title: string; body: string; cardId: string }> = [];

  for (const c of data.cards) {
    if (c.archived) continue;
    if (isMine(c.assignee, names)) {
      const id = 'card:' + c.id;
      if (!set.has(id)) { set.add(id); newly.push({ title: '📌 Card atribuído a você', body: c.name, cardId: c.id }); }
    }
    for (const s of c.subtasks || []) {
      if (isMine(s.assignee, names)) {
        const id = 'sub:' + s.id;
        if (!set.has(id)) { set.add(id); newly.push({ title: '📌 Subtarefa atribuída a você', body: `${s.text} · ${c.name}`, cardId: c.id }); }
      }
    }
  }

  if (!firstRun) {
    for (const n of newly) fire(n.title, n.body, n.cardId, '📌', 'assign');
  }
  saveAssignSeen(set);
}

export function runAllReminders() {
  runDueReminders();
  runAssignmentChecks();
}

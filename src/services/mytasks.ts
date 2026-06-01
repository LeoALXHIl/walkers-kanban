// Shared helpers for the "Minhas Tarefas" view + sidebar badge.
// Consolidates subtasks assigned to the logged-in user across every card.
import type { Card, Subtask, SubtaskStatus, Workspace } from '@/types';

export interface FlatSubtask {
  sub: Subtask;
  status: SubtaskStatus;
  cardId: string;
  cardName: string;
  colId: string;
}

// Resolve the status, tolerating legacy subtasks that only had `done`.
export function resolveSubStatus(s: Subtask): SubtaskStatus {
  return s.status || (s.done ? 'done' : 'todo');
}

// Build the set of lowercase identifiers that represent the current user,
// so we can match a subtask's free-text `assignee` against them.
export function currentUserNames(
  user: { displayName?: string | null; email?: string | null; uid?: string } | null,
  ws: Workspace | null
): Set<string> {
  const names = new Set<string>();
  if (!user) return names;
  const add = (v?: string | null) => { if (v) names.add(v.trim().toLowerCase()); };
  add(user.displayName);
  add(user.email);
  if (user.email) add(user.email.split('@')[0]);
  // Match the workspace member record tied to this uid (display name shown in pickers).
  const me = ws?.members?.find(m => m.uid === user.uid);
  if (me) { add(me.displayName); add(me.email); }
  return names;
}

export function isMine(assignee: string | null | undefined, names: Set<string>): boolean {
  if (!assignee) return false;
  return names.has(assignee.trim().toLowerCase());
}

// Flatten every non-archived card's subtasks into a single list, optionally
// scoped to the current user.
export function collectSubtasks(
  cards: Card[],
  names: Set<string>,
  mineOnly: boolean
): FlatSubtask[] {
  const out: FlatSubtask[] = [];
  for (const c of cards) {
    if (c.archived) continue;
    for (const s of c.subtasks || []) {
      if (mineOnly && !isMine(s.assignee, names)) continue;
      out.push({
        sub: s,
        status: resolveSubStatus(s),
        cardId: c.id,
        cardName: c.name,
        colId: c.cid
      });
    }
  }
  return out;
}

// Cards whose responsável is the current user (or all cards when mineOnly = false).
export function collectAssignedCards(cards: Card[], names: Set<string>, mineOnly: boolean): Card[] {
  return cards.filter(c => !c.archived && (!mineOnly || isMine(c.assignee, names)));
}

// Count of open tasks assigned to the current user — used for the sidebar badge.
// Conta: cards atribuídos a mim (não arquivados) + subtarefas minhas ainda não concluídas.
export function countMyOpenSubtasks(cards: Card[], names: Set<string>): number {
  let n = 0;
  for (const c of cards) {
    if (c.archived) continue;
    if (isMine(c.assignee, names)) n++;
    for (const s of c.subtasks || []) {
      if (isMine(s.assignee, names) && resolveSubStatus(s) !== 'done') n++;
    }
  }
  return n;
}

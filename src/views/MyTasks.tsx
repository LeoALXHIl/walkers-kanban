import { useMemo, useState } from 'react';
import { useData, setSubtaskStatus } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import { dueInfo } from '@/services/storage';
import { pickHashColor } from '@/services/colors';
import { currentUserNames, collectSubtasks, collectAssignedCards, type FlatSubtask } from '@/services/mytasks';
import type { Card, SubtaskStatus } from '@/types';

const STATUS_META: Record<SubtaskStatus, { label: string; icon: string; cls: string; order: number }> = {
  doing: { label: 'Em andamento', icon: '◐', cls: 'st-doing', order: 0 },
  todo:  { label: 'Pendente',     icon: '○', cls: 'st-todo',  order: 1 },
  done:  { label: 'Concluída',    icon: '✓', cls: 'st-done',  order: 2 }
};
const STATUS_CYCLE: SubtaskStatus[] = ['todo', 'doing', 'done'];
const PRIO_EMOJI: Record<string, string> = { high: '🔴', med: '🟡', low: '🟢' };

type SortKey = 'status' | 'due';

function dueSortVal(due: string | null | undefined): number {
  if (!due) return Number.MAX_SAFE_INTEGER;
  return new Date(due + 'T00:00:00').getTime();
}

export function MyTasksView() {
  const allCards = useData(s => s.data.cards);
  const allCols = useData(s => s.data.cols);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const openDetail = useUI(s => s.openDetail);
  const user = useAuth(s => s.user);
  const ws = useWorkspace(s => s.currentWorkspace);

  const [mineOnly, setMineOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('status');

  const cols = allCols.filter(c => !c.boardId || c.boardId === activeBoardId);
  const cards = useMemo(
    () => allCards.filter(c => !c.boardId || c.boardId === activeBoardId),
    [allCards, activeBoardId]
  );

  const names = useMemo(() => currentUserNames(user, ws), [user, ws]);

  const assignedCards = useMemo(() => {
    const list = collectAssignedCards(cards, names, mineOnly);
    return [...list].sort((a, b) => dueSortVal(a.due) - dueSortVal(b.due));
  }, [cards, names, mineOnly]);

  const items = useMemo(() => {
    const list = collectSubtasks(cards, names, mineOnly);
    if (sortKey === 'due') {
      return [...list].sort((a, b) => {
        if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
        return dueSortVal(a.sub.due) - dueSortVal(b.sub.due);
      });
    }
    return [...list].sort((a, b) => {
      const so = STATUS_META[a.status].order - STATUS_META[b.status].order;
      if (so !== 0) return so;
      return dueSortVal(a.sub.due) - dueSortVal(b.sub.due);
    });
  }, [cards, names, mineOnly, sortKey]);

  const openSubs = items.filter(i => i.status !== 'done').length;
  const totalOpen = openSubs + assignedCards.length;
  const isEmpty = items.length === 0 && assignedCards.length === 0;

  const renderCardRow = (c: Card) => {
    const col = cols.find(x => x.id === c.cid);
    const di = dueInfo(c.due);
    return (
      <div key={c.id} className="mytask-row" onClick={() => openDetail(c.id)}>
        <span className="mytask-card-dot" style={{ background: c.color || '#7c5cfc' }} />
        <div className="mytask-main">
          <span className="mytask-title">{c.name}</span>
          <span className="mytask-source">
            <span className="mytask-col">{col?.name || '—'}</span>
            {(c.subtasks?.length || 0) > 0 && (
              <>
                <span className="mytask-sep">·</span>
                <span>{c.subtasks.filter(s => s.done).length}/{c.subtasks.length} subtarefas</span>
              </>
            )}
          </span>
        </div>
        {!mineOnly && c.assignee && (
          <span className="card-avatar" title={c.assignee} style={{ width: 22, height: 22, fontSize: 9, background: pickHashColor(c.assignee) }}>
            {c.assignee.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="mytask-prio" title={`Prioridade ${c.prio}`}>{PRIO_EMOJI[c.prio || 'med']}</span>
        {di && <span className={`task-due-badge card-due ${di.cls}`}>{di.label}</span>}
      </div>
    );
  };

  const renderSubRow = (it: FlatSubtask) => {
    const col = cols.find(x => x.id === it.colId);
    const di = dueInfo(it.sub.due);
    const meta = STATUS_META[it.status];
    const cycle = (e: React.MouseEvent) => {
      e.stopPropagation();
      const idx = STATUS_CYCLE.indexOf(it.status);
      setSubtaskStatus(it.cardId, it.sub.id, STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
    };
    return (
      <div key={it.cardId + ':' + it.sub.id} className={`mytask-row ${meta.cls}`} onClick={() => openDetail(it.cardId)}>
        <button className={`subtask-status-btn ${meta.cls}`} onClick={cycle} title={`${meta.label} — clique p/ avançar`}>
          <span className="ssb-icon">{meta.icon}</span>
        </button>
        <div className="mytask-main">
          <span className={`mytask-title${it.status === 'done' ? ' done' : ''}`}>{it.sub.text}</span>
          <span className="mytask-source">
            <span className="mytask-card">{it.cardName}</span>
            <span className="mytask-sep">·</span>
            <span className="mytask-col">{col?.name || '—'}</span>
            {it.sub.note && <span className="mytask-note-flag" title={it.sub.note}>📝</span>}
          </span>
        </div>
        {!mineOnly && it.sub.assignee && (
          <span className="card-avatar" title={it.sub.assignee} style={{ width: 22, height: 22, fontSize: 9, background: pickHashColor(it.sub.assignee) }}>
            {it.sub.assignee.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className={`mytask-status-label ${meta.cls}`}>{meta.label}</span>
        {di && <span className={`task-due-badge card-due ${di.cls}`}>{di.label}</span>}
      </div>
    );
  };

  return (
    <div className="mytasks-view">
      <div className="mytasks-toolbar">
        <div className="mytasks-head-info">
          <h2 className="mytasks-h2">Minhas Tarefas</h2>
          <span className="mytasks-subcount">{totalOpen} em aberto · {assignedCards.length} card(s) · {items.length} subtarefa(s)</span>
        </div>
        <div className="mytasks-controls">
          <div className="seg-toggle">
            <button className={mineOnly ? 'active' : ''} onClick={() => setMineOnly(true)}>Minhas</button>
            <button className={!mineOnly ? 'active' : ''} onClick={() => setMineOnly(false)}>Todas</button>
          </div>
          <div className="seg-toggle">
            <button className={sortKey === 'status' ? 'active' : ''} onClick={() => setSortKey('status')}>Por status</button>
            <button className={sortKey === 'due' ? 'active' : ''} onClick={() => setSortKey('due')}>Por data</button>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="mytasks-empty">
          {mineOnly
            ? <>Nenhuma tarefa atribuída a você.<br />Defina seu nome como responsável num card ou subtarefa pra aparecer aqui.</>
            : <>Nenhuma tarefa por aqui.<br />Crie um card ou subtarefa com responsável.</>}
        </div>
      ) : (
        <>
          {assignedCards.length > 0 && (
            <div className="mytasks-group">
              <div className="mytasks-group-title">
                <span className="mytask-group-icon" style={{ border: 'none', fontSize: 13 }}>📋</span>
                Cards
                <span className="mytasks-count">{assignedCards.length}</span>
              </div>
              {assignedCards.map(renderCardRow)}
            </div>
          )}

          {items.length > 0 && (
            sortKey === 'status' ? (
              (['doing', 'todo', 'done'] as SubtaskStatus[]).map(st => {
                const group = items.filter(i => i.status === st);
                if (group.length === 0) return null;
                const meta = STATUS_META[st];
                return (
                  <div key={st} className="mytasks-group">
                    <div className="mytasks-group-title">
                      <span className={`mytask-group-icon ${meta.cls}`}>{meta.icon}</span>
                      Subtarefas · {meta.label}
                      <span className="mytasks-count">{group.length}</span>
                    </div>
                    {group.map(renderSubRow)}
                  </div>
                );
              })
            ) : (
              <div className="mytasks-group">
                <div className="mytasks-group-title">
                  <span className="mytask-group-icon" style={{ border: 'none', fontSize: 13 }}>✓</span>
                  Subtarefas
                  <span className="mytasks-count">{items.length}</span>
                </div>
                {items.map(renderSubRow)}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useData, addSprint, updateSprint, deleteSprint, addCardToSprint, removeCardFromSprint, setActiveSprint, startSprint, completeSprint } from '@/store/data';
import { useUI } from '@/store/ui';
import { toast } from '@/services/toast';
import { usePermissions } from '@/services/permissions';
import { fmt } from '@/services/storage';
import { pickHashColor } from '@/services/colors';
import type { Sprint } from '@/types';

export function SprintsView() {
  const data = useData(s => s.data);
  const { canEdit } = usePermissions();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sprintsAll = data.sprints || [];
  const sprints = sprintsAll.filter(s => s.boardId === data.activeBoardId);
  const active = sprints.find(s => s.id === data.activeSprintId) || sprints.find(s => s.status === 'active');
  const planning = sprints.filter(s => s.status === 'planning');
  const completed = sprints.filter(s => s.status === 'completed');

  const editing = editingId ? (sprints.find(s => s.id === editingId) || null) : null;

  if (creating || editing) {
    return <SprintForm sprint={editing} onClose={() => { setCreating(false); setEditingId(null); }} />;
  }

  if (sprints.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-emoji">🏃</div>
        <h2 className="board-empty-title">Sem sprints ainda</h2>
        <p className="board-empty-sub">
          Sprints agrupam cards em ciclos de 1-2 semanas com meta clara. Útil pra organizar implementações
          grandes ou semanas focadas.
        </p>
        {canEdit && (
          <div className="board-empty-actions">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Novo sprint</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} nesse board
          </div>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Novo sprint</button>}
      </div>

      {active && (
        <div>
          <div className="sb-section" style={{ marginBottom: 8 }}>🔥 Em andamento</div>
          <SprintCard sprint={active} onEdit={() => setEditingId(active.id)} />
        </div>
      )}

      {planning.length > 0 && (
        <div>
          <div className="sb-section" style={{ marginBottom: 8 }}>📅 Planejados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {planning.map(s => <SprintCard key={s.id} sprint={s} onEdit={() => setEditingId(s.id)} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div className="sb-section" style={{ marginBottom: 8 }}>🏆 Concluídos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completed.slice(0, 5).map(s => <SprintCard key={s.id} sprint={s} onEdit={() => setEditingId(s.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SprintCard({ sprint, onEdit }: { sprint: Sprint; onEdit: () => void }) {
  const cards = useData(s => s.data.cards);
  const cols = useData(s => s.data.cols);
  const openDetail = useUI(s => s.openDetail);
  const { canEdit } = usePermissions();
  const lastColId = cols.filter(c => c.boardId === sprint.boardId).slice(-1)[0]?.id;
  const sprintCards = cards.filter(c => sprint.cardIds.includes(c.id));
  const done = sprintCards.filter(c => c.cid === lastColId).length;
  const pct = sprintCards.length > 0 ? Math.round((done / sprintCards.length) * 100) : 0;
  const start = new Date(sprint.startDate + 'T00:00:00');
  const end = new Date(sprint.endDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const daysPassed = Math.max(0, Math.min(totalDays, Math.round((today.getTime() - start.getTime()) / 86400000)));
  const timePct = Math.min(100, Math.round((daysPassed / totalDays) * 100));
  const colorPct = pct >= timePct - 5 ? 'var(--green)' : pct >= timePct - 20 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="dash-card" style={{ borderLeft: `4px solid ${sprint.status === 'active' ? 'var(--accent)' : sprint.status === 'completed' ? 'var(--green)' : 'var(--text3)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{sprint.emoji || '🏃'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{sprint.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {fmt(start.getTime())} → {fmt(end.getTime())} · {totalDays} dia{totalDays > 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colorPct, fontFamily: 'Geist Mono, monospace' }}>{pct}%</div>
          <div style={{ fontSize: 9, color: 'var(--text3)' }}>{done}/{sprintCards.length}</div>
        </div>
      </div>

      {sprint.goal && (
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontStyle: 'italic' }}>"{sprint.goal}"</div>
      )}

      {/* Progress bars */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: colorPct, transition: 'width .3s ease' }} />
        </div>
        <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${timePct}%`, background: 'var(--text3)', opacity: .6 }} />
        </div>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
          <span>Progresso (cards done)</span>
          <span>Tempo: {daysPassed}/{totalDays}d</span>
        </div>
      </div>

      {/* Cards list */}
      {sprintCards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          {sprintCards.slice(0, 5).map(c => {
            const isDone = c.cid === lastColId;
            return (
              <div
                key={c.id}
                onClick={() => openDetail(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                  fontSize: 11, color: isDone ? 'var(--text3)' : 'var(--text2)',
                  textDecoration: isDone ? 'line-through' : 'none',
                  cursor: 'pointer', borderRadius: 4
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color || pickHashColor(c.name), flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {isDone && <span style={{ color: 'var(--green)', fontSize: 9 }}>✓</span>}
              </div>
            );
          })}
          {sprintCards.length > 5 && (
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '2px 6px' }}>+{sprintCards.length - 5} mais</div>
          )}
        </div>
      )}

      {/* Actions */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sprint.status === 'planning' && (
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => { startSprint(sprint.id); toast.success('Sprint iniciado', { icon: '🚀' }); }}>
              ▶ Iniciar
            </button>
          )}
          {sprint.status === 'active' && (
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => { completeSprint(sprint.id); toast.success('Sprint concluído!', { icon: '🏆' }); }}>
              ✓ Concluir
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 11px' }} onClick={onEdit}>✏️ Editar</button>
          <AddCardsButton sprint={sprint} />
        </div>
      )}
    </div>
  );
}

function AddCardsButton({ sprint }: { sprint: Sprint }) {
  const [open, setOpen] = useState(false);
  const cards = useData(s => s.data.cards.filter(c => c.boardId === sprint.boardId && !c.archived && !sprint.cardIds.includes(c.id)));

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => setOpen(o => !o)}>
        + Cards
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--rs)', padding: 6, zIndex: 100, minWidth: 240, maxHeight: 280, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          {cards.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: 8 }}>Nenhum card disponível</div>
          ) : cards.slice(0, 30).map(c => (
            <button
              key={c.id}
              className="bm-item"
              onClick={() => { addCardToSprint(sprint.id, c.id); toast.success(`"${c.name}" adicionado`); setOpen(false); }}
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: 11 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color || pickHashColor(c.name) }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SprintForm({ sprint, onClose }: { sprint: Sprint | null; onClose: () => void }) {
  const activeBoardId = useData(s => s.data.activeBoardId) || '';
  const today = new Date();
  const in2weeks = new Date(today); in2weeks.setDate(in2weeks.getDate() + 14);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const [name, setName] = useState(sprint?.name || '');
  const [emoji, setEmoji] = useState(sprint?.emoji || '🏃');
  const [goal, setGoal] = useState(sprint?.goal || '');
  const [startDate, setStartDate] = useState(sprint?.startDate || fmtDate(today));
  const [endDate, setEndDate] = useState(sprint?.endDate || fmtDate(in2weeks));

  const submit = () => {
    if (!name.trim()) { toast.error('Coloca um nome'); return; }
    const payload = { name: name.trim(), emoji, goal: goal.trim() || undefined, startDate, endDate, boardId: activeBoardId };
    if (sprint) updateSprint(sprint.id, payload);
    else addSprint(payload);
    toast.success(`Sprint "${name}" ${sprint ? 'atualizado' : 'criado'}`, { icon: emoji });
    onClose();
  };

  const del = () => {
    if (!sprint) return;
    if (!confirm(`Excluir o sprint "${sprint.name}"?`)) return;
    deleteSprint(sprint.id);
    toast.success('Sprint excluído');
    onClose();
  };

  const EMOJIS = ['🏃', '🚀', '🎯', '💪', '🔥', '⚡', '🌟', '💎'];

  return (
    <div style={{ padding: '16px 20px', maxWidth: 560 }}>
      <h2 style={{ marginBottom: 14 }}>{sprint ? 'Editar sprint' : 'Novo sprint'}</h2>
      <div className="frow">
        <label className="flabel">Nome *</label>
        <input className="finput" placeholder="Ex: Sprint 14 — Magazord WhatsApp" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div className="frow">
        <label className="flabel">Meta do sprint (opcional)</label>
        <textarea className="finput" rows={2} placeholder="Ex: Implementar fluxo WhatsApp da Magazord do zero ao deploy" value={goal} onChange={e => setGoal(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="frow">
          <label className="flabel">Início</label>
          <input className="finput" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Fim</label>
          <input className="finput" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Emoji</label>
          <div className="cpicker" style={{ flexWrap: 'wrap' }}>
            {EMOJIS.map(e => (
              <div key={e} className={`copt${e === emoji ? ' sel' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'var(--bg3)' }} onClick={() => setEmoji(e)}>{e}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="mfoot" style={{ justifyContent: 'space-between' }}>
        {sprint && <button className="btn btn-danger" onClick={del}>🗑️ Excluir</button>}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>{sprint ? 'Salvar' : 'Criar sprint'}</button>
        </div>
      </div>
    </div>
  );
}

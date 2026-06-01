import { useState } from 'react';
import { useData, addGoal, updateGoal, deleteGoal } from '@/store/data';
import { quickPrompt } from '@/services/quickPrompt';
import { toast } from '@/services/toast';
import { usePermissions } from '@/services/permissions';
import type { Goal, GoalType } from '@/types';

const EMOJIS = ['🎯', '🚀', '💰', '📈', '⭐', '🏆', '💼', '🎓', '🔥', '⚡', '🌟', '💎'];
const COLORS = ['#7c5cfc', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#38bdf8', '#a855f7'];

export function GoalsView() {
  const goals = useData(s => s.data.goals || []);
  const { canEdit } = usePermissions();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId ? (goals.find(g => g.id === editingId) || null) : null;
  const formMode = creating || !!editing;

  const active = goals.filter(g => g.status === 'active');
  const achieved = goals.filter(g => g.status === 'achieved');
  const archived = goals.filter(g => g.status === 'archived');

  if (formMode) {
    return <GoalForm goal={editing} onClose={() => { setCreating(false); setEditingId(null); }} />;
  }

  if (goals.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-emoji">🎯</div>
        <h2 className="board-empty-title">Sem metas ainda</h2>
        <p className="board-empty-sub">
          Defina objetivos trimestrais ou mensais — fatura R$ 30k em Q2, fechar 5 implementações Magazord, etc.
          Os cards do operacional vão somar pra cá automaticamente.
        </p>
        {canEdit && (
          <div className="board-empty-actions">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nova meta</button>
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
            {active.length} ativas · {achieved.length} alcançadas · {archived.length} arquivadas
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nova meta</button>
        )}
      </div>

      {active.length > 0 && (
        <div>
          <div className="sb-section" style={{ marginBottom: 8 }}>Ativas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {active.map(g => <GoalCard key={g.id} goal={g} onEdit={() => setEditingId(g.id)} />)}
          </div>
        </div>
      )}

      {achieved.length > 0 && (
        <div>
          <div className="sb-section" style={{ marginBottom: 8 }}>Alcançadas 🏆</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {achieved.map(g => <GoalCard key={g.id} goal={g} onEdit={() => setEditingId(g.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const cards = useData(s => s.data.cards);
  const { canEdit } = usePermissions();
  // Compute progress
  let current = goal.current || 0;
  if (goal.linkedCardIds && goal.linkedCardIds.length > 0) {
    const linked = cards.filter(c => goal.linkedCardIds!.includes(c.id));
    const lastColId = useData.getState().data.cols.slice(-1)[0]?.id;
    if (goal.type === 'milestone') {
      // % concluído baseado em cards
      const done = linked.filter(c => c.cid === lastColId || c.archived).length;
      current = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0;
    } else if (goal.type === 'numeric' && !goal.current) {
      // Numeric: count done cards if no manual current set
      current = linked.filter(c => c.cid === lastColId || c.archived).length;
    }
  }
  const target = goal.target || (goal.type === 'milestone' ? 100 : 1);
  const pct = Math.min(100, Math.round((current / target) * 100));
  const color = goal.color || '#7c5cfc';

  return (
    <div className="dash-card" style={{ borderLeft: `4px solid ${color}`, cursor: canEdit ? 'pointer' : 'default' }} onClick={canEdit ? onEdit : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{goal.emoji || '🎯'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</div>
          {goal.period && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{goal.period}</div>}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'Geist Mono, monospace' }}>{pct}%</div>
      </div>
      {goal.description && (
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.4 }}>{goal.description}</div>
      )}
      <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, transition: 'width .3s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
        <span>
          {goal.type === 'numeric' ? `${current} de ${target}${goal.unit ? ' ' + goal.unit : ''}` : `${current}% completo`}
        </span>
        {(goal.linkedCardIds?.length || 0) > 0 && (
          <span>📌 {goal.linkedCardIds!.length} card(s) vinculado(s)</span>
        )}
      </div>
    </div>
  );
}

function GoalForm({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [name, setName] = useState(goal?.name || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [emoji, setEmoji] = useState(goal?.emoji || '🎯');
  const [color, setColor] = useState(goal?.color || COLORS[0]);
  const [type, setType] = useState<GoalType>(goal?.type || 'numeric');
  const [target, setTarget] = useState(goal?.target?.toString() || '');
  const [unit, setUnit] = useState(goal?.unit || '');
  const [period, setPeriod] = useState(goal?.period || `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][new Date().getMonth()]} ${new Date().getFullYear()}`);

  const submit = () => {
    if (!name.trim()) { toast.error('Coloca um nome pra meta'); return; }
    const t = type === 'milestone' ? 100 : (Number(target) || 1);
    const payload = {
      name: name.trim(), description, emoji, color, type, target: t,
      unit: unit.trim() || undefined, period
    };
    if (goal) updateGoal(goal.id, payload);
    else addGoal(payload);
    toast.success(`Meta "${name}" ${goal ? 'atualizada' : 'criada'}`, { icon: emoji });
    onClose();
  };

  const del = () => {
    if (!goal) return;
    if (!confirm(`Excluir a meta "${goal.name}"?`)) return;
    deleteGoal(goal.id);
    toast.success('Meta excluída');
    onClose();
  };

  return (
    <div style={{ padding: '16px 20px', maxWidth: 560 }}>
      <h2 style={{ marginBottom: 14 }}>{goal ? 'Editar meta' : 'Nova meta'}</h2>

      <div className="frow">
        <label className="flabel">Nome *</label>
        <input className="finput" placeholder="Ex: Fechar 10 implementações em Q2" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>

      <div className="frow">
        <label className="flabel">Descrição (opcional)</label>
        <textarea className="finput" rows={2} placeholder="Por que essa meta é importante?" value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="frow">
          <label className="flabel">Emoji</label>
          <div className="cpicker" style={{ flexWrap: 'wrap' }}>
            {EMOJIS.map(e => (
              <div key={e} className={`copt${e === emoji ? ' sel' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--bg3)' }} onClick={() => setEmoji(e)}>{e}</div>
            ))}
          </div>
        </div>
        <div className="frow">
          <label className="flabel">Cor</label>
          <div className="cpicker">
            {COLORS.map(h => (
              <div key={h} className={`copt${h === color ? ' sel' : ''}`} style={{ background: h }} onClick={() => setColor(h)} />
            ))}
          </div>
        </div>
      </div>

      <div className="frow">
        <label className="flabel">Tipo</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button className={`type-opt${type === 'numeric' ? ' sel' : ''}`} onClick={() => setType('numeric')}>
            <div style={{ fontSize: 14 }}>📊 Numérica</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Meta com valor (ex: 30k R$, 10 cards)</div>
          </button>
          <button className={`type-opt${type === 'milestone' ? ' sel' : ''}`} onClick={() => setType('milestone')}>
            <div style={{ fontSize: 14 }}>🏁 Milestone</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>% completo de cards vinculados</div>
          </button>
        </div>
      </div>

      {type === 'numeric' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="frow">
            <label className="flabel">Alvo *</label>
            <input className="finput" type="number" placeholder="30000" value={target} onChange={e => setTarget(e.target.value)} />
          </div>
          <div className="frow">
            <label className="flabel">Unidade</label>
            <input className="finput" placeholder="R$, cards, clientes…" value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
      )}

      <div className="frow">
        <label className="flabel">Período</label>
        <input className="finput" placeholder="Q1 2026, Maio 2026, 2026…" value={period} onChange={e => setPeriod(e.target.value)} />
      </div>

      <div className="mfoot" style={{ justifyContent: 'space-between' }}>
        {goal && <button className="btn btn-danger" onClick={del}>🗑️ Excluir</button>}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>{goal ? 'Salvar' : 'Criar meta'}</button>
        </div>
      </div>
    </div>
  );
}

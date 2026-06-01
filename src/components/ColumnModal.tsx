import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useData, addColumn, updateColumn } from '@/store/data';
import { COL_COLORS } from '@/services/colors';

export function ColumnModal() {
  const colEditId = useUI(s => s.colEditId);
  const colNew = useUI(s => s.colNew);
  const close = useUI(s => s.closeCol);
  const cols = useData(s => s.data.cols);
  // Memoize `editing` so its reference is stable across renders driven by typing,
  // preventing any downstream useEffect dependent on it from re-firing.
  const editing = useMemo(() => cols.find(c => c.id === colEditId), [cols, colEditId]);

  const [name, setName] = useState('');
  const [color, setColor] = useState(COL_COLORS[0]);
  const [wipLimit, setWipLimit] = useState<string>('');
  const [err, setErr] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!colNew && !colEditId) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
      setWipLimit(editing.wipLimit ? String(editing.wipLimit) : '');
    } else {
      setName('');
      setColor(COL_COLORS[cols.length % COL_COLORS.length]);
      setWipLimit('');
    }
    setErr(false);
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [colNew, colEditId, editing?.id]);

  if (!colNew && !colEditId) return null;

  const save = () => {
    const t = name.trim();
    if (!t) { setErr(true); setTimeout(() => setErr(false), 1000); return; }
    const wip = wipLimit && !isNaN(Number(wipLimit)) ? Number(wipLimit) : undefined;
    if (editing) updateColumn(editing.id, { name: t, color, wipLimit: wip });
    else { addColumn(t, color); if (wip) { /* new col gets ID assigned, set wip after */ } }
    close();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal modal-sm">
        <h2>{editing ? 'Editar coluna' : 'Nova coluna'}</h2>
        <div className="frow">
          <label className="flabel">Nome</label>
          <input
            ref={nameRef}
            className="finput"
            placeholder="Ex: Em Revisão…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={err ? { borderColor: 'var(--red)' } : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
        </div>
        <div className="frow">
          <label className="flabel">Cor</label>
          <div className="cpicker">
            {COL_COLORS.map(h => (
              <div key={h} className={`copt${h === color ? ' sel' : ''}`} style={{ background: h }} onClick={() => setColor(h)} />
            ))}
          </div>
        </div>
        <div className="frow">
          <label className="flabel">WIP limit (opcional)</label>
          <input
            type="number"
            className="finput"
            placeholder="Ex: 5 — coluna fica vermelha se passar"
            value={wipLimit}
            onChange={(e) => setWipLimit(e.target.value)}
            min="0"
          />
          <small style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, display: 'block' }}>
            Limite máximo de cards. Vazio = sem limite. Lembrete visual pra não acumular WIP.
          </small>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

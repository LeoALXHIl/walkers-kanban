import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useData, addBoard, updateBoard, deleteBoard } from '@/store/data';
import { COL_COLORS } from '@/services/colors';
import { toast } from '@/services/toast';
import { usePlan, planLimits } from '@/services/plan';
import { useUpgrade } from './UpgradeModal';

const EMOJIS = ['🚀', '🎯', '💼', '🏠', '📚', '💡', '🛠️', '🎨', '🔥', '⚡', '🌟', '📋'];

export function BoardModal() {
  const open = useUI(s => s.boardModalOpen);
  const editId = useUI(s => s.boardModalEditId);
  const close = useUI(s => s.closeBoardModal);
  const boards = useData(s => s.data.boards || []);
  const editing = useMemo(() => boards.find(b => b.id === editId), [boards, editId]);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🚀');
  const [color, setColor] = useState(COL_COLORS[0]);
  const [err, setErr] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setEmoji(editing.emoji || '📋');
      setColor(editing.color || COL_COLORS[0]);
    } else {
      setName('');
      setEmoji(EMOJIS[boards.length % EMOJIS.length]);
      setColor(COL_COLORS[boards.length % COL_COLORS.length]);
    }
    setErr(false);
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [open, editing?.id]);

  if (!open) return null;

  const save = () => {
    const t = name.trim();
    if (!t) { setErr(true); setTimeout(() => setErr(false), 1000); return; }
    // Gating de plano: Free = 1 board (criação; editar continua livre)
    if (!editing) {
      const { plan } = usePlan.getState();
      if (boards.length >= planLimits(plan).boards) {
        close();
        useUpgrade.getState().show('boards');
        return;
      }
    }
    if (editing) {
      updateBoard(editing.id, { name: t, emoji, color });
      toast.success('Board atualizado');
    } else {
      addBoard(t, emoji, color);
      toast.success(`Board "${t}" criado`, { icon: emoji });
    }
    close();
  };

  const del = () => {
    if (!editing) return;
    if (boards.length <= 1) { toast.error('Você não pode excluir o último board'); return; }
    const r = deleteBoard(editing.id);
    if (r.cardCount > 0 || r.colCount > 0) {
      toast.success(`Board "${r.name}" excluído (${r.cardCount} cards, ${r.colCount} colunas)`);
    } else {
      toast.success(`Board "${r.name}" excluído`);
    }
    close();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal modal-sm">
        <h2>{editing ? 'Editar board' : 'Novo board'}</h2>
        <div className="frow">
          <label className="flabel">Nome</label>
          <input
            ref={nameRef}
            className="finput"
            placeholder="Ex: Implementações, Pessoal, Estudos…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={err ? { borderColor: 'var(--red)' } : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
        </div>
        <div className="frow">
          <label className="flabel">Emoji</label>
          <div className="cpicker" style={{ flexWrap: 'wrap' }}>
            {EMOJIS.map(e => (
              <div
                key={e}
                className={`copt${e === emoji ? ' sel' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--bg3)' }}
                onClick={() => setEmoji(e)}
              >{e}</div>
            ))}
          </div>
        </div>
        <div className="frow">
          <label className="flabel">Cor</label>
          <div className="cpicker">
            {COL_COLORS.map(h => (
              <div key={h} className={`copt${h === color ? ' sel' : ''}`} style={{ background: h }} onClick={() => setColor(h)} />
            ))}
          </div>
        </div>
        {!editing && (
          <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 8px' }}>
            O novo board virá com as 4 colunas padrão (A Iniciar, Em Implementação, Aguardando Cliente, Concluído).
          </p>
        )}
        <div className="mfoot" style={{ justifyContent: 'space-between' }}>
          {editing && boards.length > 1 ? (
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm(`Excluir o board "${editing.name}"? Todos os cards e colunas dele serão apagados.`)) del();
            }}>🗑️ Excluir</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" onClick={close}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>{editing ? 'Salvar' : 'Criar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import type { Card as CardType, Column as ColumnType } from '@/types';
import { useUI } from '@/store/ui';
import { addCard } from '@/store/data';
import { genId } from '@/services/storage';
import { CARD_COLORS } from '@/services/colors';
import { usePermissions } from '@/services/permissions';
import { EditIcon, TrashIcon } from '@/services/icons';
import { CardItem } from './Card';

interface Props {
  column: ColumnType;
  cards: CardType[];
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  onColDragStart: (id: string) => void;
  onColDragEnd: () => void;
  onDrop: (targetCid: string) => void;
}

export function ColumnView({ column, cards, onCardDragStart, onCardDragEnd, onColDragStart, onColDragEnd, onDrop }: Props) {
  const openCol = useUI(s => s.openCol);
  const askDelCol = useUI(s => s.askDelCol);
  const openNewCard = useUI(s => s.openNewCard);
  const { canEdit } = usePermissions();
  const [over, setOver] = useState(false);
  // UX-1: inline quick-add at bottom of column
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);

  const submitQuick = () => {
    const n = quickName.trim();
    if (!n) { setQuickAdd(false); setQuickName(''); return; }
    addCard({
      id: genId(), cid: column.id, name: n, plat: [], prio: 'med',
      color: CARD_COLORS[0], note: '', desc: '', assignee: null, due: null,
      tagIds: [], subtasks: [], attachments: [], comments: [], ts: Date.now()
    });
    setQuickName('');
    // Stay open so user can add multiple cards in a row
    setTimeout(() => quickRef.current?.focus(), 30);
  };

  const overWip = column.wipLimit !== undefined && column.wipLimit > 0 && cards.length > column.wipLimit;

  return (
    <div
      className={`column${over ? ' drag-over' : ''}${overWip ? ' wip-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(column.id); }}
    >
      <div className="col-header">
        <div
          className="col-title"
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onColDragStart(column.id); (e.currentTarget.closest('.column') as HTMLElement)?.classList.add('col-ghost'); }}
          onDragEnd={(e) => { (e.currentTarget.closest('.column') as HTMLElement)?.classList.remove('col-ghost'); onColDragEnd(); }}
        >
          <div className="col-dot" style={{ background: column.color }} />
          <span className="col-name-text" title={column.name}>{column.name}</span>
          <span className="col-count">{cards.length}</span>
        </div>
        {canEdit && (
          <>
            <div className="col-acts">
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openCol(column.id); }}>
                <EditIcon />
              </button>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); askDelCol(column.id); }}>
                <TrashIcon />
              </button>
            </div>
            <button className="col-plus" onClick={(e) => { e.stopPropagation(); openNewCard(column.id); }}>+</button>
          </>
        )}
      </div>
      <div className="col-cards">
        {cards.length === 0 && !quickAdd ? (
          <div className="col-empty">Vazio. Clique em + ou peça pro Claude.</div>
        ) : (
          cards.map(c => (
            <CardItem key={c.id} card={c} onDragStart={onCardDragStart} onDragEnd={onCardDragEnd} />
          ))
        )}
        {quickAdd && (
          <div className="quick-add">
            <input
              ref={quickRef}
              autoFocus
              className="quick-add-input"
              placeholder="Nome do cliente / título do card…"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submitQuick(); }
                else if (e.key === 'Escape') { e.preventDefault(); setQuickAdd(false); setQuickName(''); }
              }}
              onBlur={() => { if (!quickName.trim()) setQuickAdd(false); }}
            />
            <div className="quick-add-foot">
              <button className="btn btn-primary" onClick={submitQuick} style={{ fontSize: 11, padding: '4px 10px' }}>+ Adicionar</button>
              <button className="btn btn-ghost" onClick={() => { setQuickAdd(false); setQuickName(''); }} style={{ fontSize: 11, padding: '4px 10px' }}>Cancelar</button>
              <span className="quick-add-hint">Enter ↵ adiciona · Esc cancela</span>
            </div>
          </div>
        )}
        {!quickAdd && canEdit && (
          <button
            className="quick-add-btn"
            onClick={() => { setQuickAdd(true); setQuickName(''); }}
            title="Adicionar card rapidinho"
          >+ Adicionar card</button>
        )}
      </div>
    </div>
  );
}

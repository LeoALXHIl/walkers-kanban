import { useRef } from 'react';
import { useData, moveCard, reorderColumns } from '@/store/data';
import { useUI } from '@/store/ui';
import { useNotifications } from '@/store/notifications';
import { ColumnView } from '@/components/Column';
import { useFilteredCards } from '@/hooks/useFilteredCards';
import { toast } from '@/services/toast';
import { usePermissions } from '@/services/permissions';
import { PlusIcon } from '@/services/icons';

export function KanbanView() {
  const allCols = useData(s => s.data.cols);
  const allCardsRaw = useData(s => s.data.cards);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const cols = allCols.filter(c => !c.boardId || c.boardId === activeBoardId);
  const allCards = allCardsRaw.filter(c => !c.boardId || c.boardId === activeBoardId);
  const openCol = useUI(s => s.openCol);
  const openNewCard = useUI(s => s.openNewCard);
  const filtered = useFilteredCards();
  const addNotif = useNotifications(s => s.add);
  const { canEdit } = usePermissions();

  const dragCard = useRef<string | null>(null);
  const dragCol = useRef<string | null>(null);

  const handleDrop = (targetCid: string) => {
    if (!canEdit) { dragCard.current = null; dragCol.current = null; return; }
    if (dragCard.current) {
      const id = dragCard.current;
      dragCard.current = null;
      const { moved, oldName, newName, reachedLast } = moveCard(id, targetCid);
      if (moved && oldName && newName && oldName !== newName) {
        const card = useData.getState().data.cards.find(c => c.id === id);
        addNotif({
          type: 'move',
          icon: '🔀',
          title: `${card?.name || 'Card'} movido`,
          sub: `${oldName} → ${newName}`,
          ts: Date.now(),
          cardId: id
        });
        if (reachedLast) {
          toast.success(`🎉 ${card?.name || 'Card'} concluído!`, { durationMs: 4200 });
        } else {
          toast.info(`${oldName} → ${newName}`, { icon: '🔀', durationMs: 2200 });
        }
      }
    } else if (dragCol.current && dragCol.current !== targetCid) {
      reorderColumns(dragCol.current, targetCid);
      dragCol.current = null;
    }
  };

  // Empty-state when the whole board has zero cards
  if (cols.length > 0 && allCards.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-emoji">🎯</div>
        <h2 className="board-empty-title">Seu board tá em branco</h2>
        <p className="board-empty-sub">
          Crie seu primeiro card pra começar o streak.<br />
          Aperte <kbd>N</kbd> ou <kbd>Ctrl+K</kbd> pra ações rápidas.
        </p>
        <div className="board-empty-actions">
          <button className="btn btn-primary" onClick={() => openNewCard()}>
            <PlusIcon /> Criar primeiro card
          </button>
        </div>
        <div className="board-empty-hint">
          💡 Dica: também dá pra ditar (🎤 no topo) ou colar um print de WhatsApp (Ctrl+V)
        </div>
      </div>
    );
  }

  return (
    <div className="board">
      {cols.map(col => (
        <ColumnView
          key={col.id}
          column={col}
          cards={filtered.filter(c => c.cid === col.id)}
          onCardDragStart={(id) => { dragCard.current = id; dragCol.current = null; }}
          onCardDragEnd={() => { dragCard.current = null; }}
          onColDragStart={(id) => { dragCol.current = id; dragCard.current = null; }}
          onColDragEnd={() => { dragCol.current = null; }}
          onDrop={handleDrop}
        />
      ))}
      {canEdit && <button className="btn-add-col" onClick={() => openCol()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="3" y="3" width="7" height="18" rx="1.5" />
          <rect x="14" y="3" width="7" height="18" rx="1.5" />
          <path d="M17.5 8v8M13.5 12h8" />
        </svg>
        Nova coluna
      </button>}
    </div>
  );
}

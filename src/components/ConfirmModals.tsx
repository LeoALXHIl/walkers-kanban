import { useUI } from '@/store/ui';
import { useData, deleteCard, deleteColumn, archiveCard } from '@/store/data';
import { useNotifications } from '@/store/notifications';
import { toast } from '@/services/toast';

export function DeleteCardModal() {
  const delCardId = useUI(s => s.delCardId);
  const cancel = useUI(s => s.cancelDelCard);
  const card = useData(s => s.data.cards.find(c => c.id === delCardId));
  const addNotif = useNotifications(s => s.add);

  if (!delCardId) return null;

  const doArchive = () => {
    if (card) {
      archiveCard(card.id, true);
      toast.success(`"${card.name}" foi pro arquivo`, { icon: '📦', durationMs: 3000 });
    }
    cancel();
  };

  const doDelete = () => {
    if (!card) return;
    if (!confirm(`Apagar PERMANENTEMENTE "${card.name}"? Isso não pode ser desfeito.`)) return;
    deleteCard(card.id);
    addNotif({ type: 'delete', icon: '🗑️', title: `Card removido: ${card.name}`, sub: 'Ação irreversível', ts: Date.now() });
    toast.warn(`Card "${card.name}" apagado permanentemente`, { icon: '🗑️' });
    cancel();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="modal modal-sm">
        <h2>O que fazer com "{card?.name}"?</h2>
        <p>
          <strong>Arquivar</strong> tira o card da vista mas mantém os dados — você pode recuperar depois em "Arquivo".<br /><br />
          <strong>Apagar</strong> é definitivo e não pode ser desfeito.
        </p>
        <div className="mfoot" style={{ gap: 6 }}>
          <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={doDelete} style={{ background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)' }}>Apagar permanente</button>
          <button className="btn btn-primary" onClick={doArchive}>📦 Arquivar</button>
        </div>
      </div>
    </div>
  );
}

export function DeleteColumnModal() {
  const delColId = useUI(s => s.delColId);
  const cancel = useUI(s => s.cancelDelCol);
  const col = useData(s => s.data.cols.find(c => c.id === delColId));
  const cardCount = useData(s => s.data.cards.filter(c => c.cid === delColId).length);

  if (!delColId || !col) return null;

  const confirm = () => {
    const result = deleteColumn(col.id);
    cancel();
    toast.warn(
      result.movedCount > 0
        ? `Coluna "${result.name}" excluída — ${result.movedCount} card(s) movido(s)`
        : `Coluna "${result.name}" excluída`,
      { icon: '🗑️' }
    );
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="modal modal-sm">
        <h2>Excluir coluna?</h2>
        <p>
          Excluir <strong>"{col.name}"</strong>?
          {cardCount > 0 ? <> Tem <strong>{cardCount} card(s)</strong> que serão movidos.</> : ' Está vazia.'}
        </p>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={confirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

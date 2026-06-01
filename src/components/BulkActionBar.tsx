import { useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useData, archiveCard, deleteCard, updateCard } from '@/store/data';
import { toast } from '@/services/toast';

export function BulkActionBar() {
  const selectedIds = useUI(s => s.selectedCardIds);
  const clearSelection = useUI(s => s.clearCardSelection);
  const cols = useData(s => s.data.cols);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const boardCols = cols.filter(c => !c.boardId || c.boardId === activeBoardId);

  // Esc clears selection
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedIds.length, clearSelection]);

  if (selectedIds.length === 0) return null;

  const bulkArchive = () => {
    selectedIds.forEach(id => archiveCard(id, true));
    toast.success(`${selectedIds.length} card(s) arquivado(s)`, { icon: '📦' });
    clearSelection();
  };

  const bulkDelete = () => {
    if (!confirm(`Excluir ${selectedIds.length} card(s) permanentemente?`)) return;
    selectedIds.forEach(id => deleteCard(id));
    toast.success(`${selectedIds.length} card(s) excluído(s)`, { icon: '🗑️' });
    clearSelection();
  };

  const bulkMove = (cid: string) => {
    selectedIds.forEach(id => updateCard(id, { cid }));
    const col = boardCols.find(c => c.id === cid);
    toast.success(`${selectedIds.length} card(s) movido(s) para "${col?.name || '—'}"`, { icon: '🔀' });
    clearSelection();
  };

  const bulkPrio = (prio: 'high' | 'med' | 'low') => {
    selectedIds.forEach(id => updateCard(id, { prio }));
    toast.success(`Prioridade atualizada`, { icon: prio === 'high' ? '🔴' : prio === 'med' ? '🟡' : '🟢' });
    clearSelection();
  };

  return (
    <div className="bulk-bar">
      <span className="bulk-count">{selectedIds.length} card(s) selecionado(s)</span>
      <div className="bulk-actions">
        <select
          className="bulk-select"
          onChange={(e) => { if (e.target.value) bulkMove(e.target.value); }}
          defaultValue=""
        >
          <option value="">Mover pra…</option>
          {boardCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-ghost bulk-btn" onClick={() => bulkPrio('high')} title="Alta">🔴</button>
        <button className="btn btn-ghost bulk-btn" onClick={() => bulkPrio('med')} title="Média">🟡</button>
        <button className="btn btn-ghost bulk-btn" onClick={() => bulkPrio('low')} title="Baixa">🟢</button>
        <button className="btn btn-ghost bulk-btn" onClick={bulkArchive}>📦 Arquivar</button>
        <button className="btn btn-danger bulk-btn" onClick={bulkDelete}>🗑️ Excluir</button>
      </div>
      <button className="bulk-close" onClick={clearSelection} title="Limpar seleção (Esc)">✕</button>
    </div>
  );
}

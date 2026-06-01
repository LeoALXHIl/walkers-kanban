import { useMemo, useState } from 'react';
import { useData, archiveCard, deleteCard } from '@/store/data';
import { useUI } from '@/store/ui';
import { pickHashColor } from '@/services/colors';
import { fmt } from '@/services/storage';
import { toast } from '@/services/toast';
import { PRIO_LABEL, PRIO_CLASS } from '@/services/icons';

export function ArchiveView() {
  const data = useData(s => s.data);
  const openDetail = useUI(s => s.openDetail);
  const [search, setSearch] = useState('');

  const archived = useMemo(() => {
    const list = data.cards.filter(c => c.archived && (!c.boardId || c.boardId === data.activeBoardId));
    if (!search.trim()) return list.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    const q = search.toLowerCase();
    return list
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q) ||
        (c.desc || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  }, [data.cards, data.activeBoardId, search]);

  const colByName = (cid: string) => data.cols.find(c => c.id === cid)?.name || '—';

  const onRestore = (id: string, name: string) => {
    archiveCard(id, false);
    toast.success(`"${name}" restaurado pro board`, { icon: '📤', durationMs: 2500 });
  };

  const onPermanentDelete = (id: string, name: string) => {
    if (!confirm(`Apagar PERMANENTEMENTE "${name}"? Não pode ser desfeito.`)) return;
    deleteCard(id);
    toast.warn(`"${name}" apagado permanentemente`, { icon: '🗑️' });
  };

  return (
    <div className="clients-view">
      <div className="clients-summary">
        <div className="clients-stat">
          <div className="clients-stat-n">{data.cards.filter(c => c.archived).length}</div>
          <div className="clients-stat-label">Total arquivado</div>
        </div>
        <div className="clients-stat">
          <div className="clients-stat-n">{archived.length}</div>
          <div className="clients-stat-label">Resultados</div>
        </div>
      </div>

      <div className="clients-toolbar">
        <input
          className="search-input"
          placeholder="Buscar nos arquivados..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          Cards arquivados ficam fora da vista mas dados ficam salvos pra sempre.
        </span>
      </div>

      {archived.length === 0 ? (
        <div className="board-empty">
          <div className="board-empty-emoji">📦</div>
          <h2 className="board-empty-title">{search ? 'Nada encontrado' : 'Arquivo vazio'}</h2>
          <p className="board-empty-sub">
            {search ? 'Tente outra busca.' : 'Quando você arquivar um card, ele aparece aqui pra você restaurar depois.'}
          </p>
        </div>
      ) : (
        <div className="archive-list">
          {archived.map(c => {
            const pc = PRIO_CLASS[c.prio];
            const pl = PRIO_LABEL[c.prio];
            return (
              <div key={c.id} className="archive-row" onClick={() => openDetail(c.id)}>
                <div className="task-dot" style={{ background: c.color || '#7c5cfc' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    {colByName(c.cid)} · Arquivado {fmt(c.archivedAt)} · Criado {fmt(c.ts)}
                  </div>
                </div>
                <span className={`badge ${pc}`} style={{ flexShrink: 0 }}>{pl}</span>
                {c.assignee && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="card-avatar" style={{ background: pickHashColor(c.assignee), width: 18, height: 18 }}>
                      {c.assignee.slice(0, 2).toUpperCase()}
                    </span>
                    {c.assignee}
                  </span>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={(e) => { e.stopPropagation(); onRestore(c.id, c.name); }}
                  style={{ fontSize: 11 }}
                >
                  📤 Restaurar
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={(e) => { e.stopPropagation(); onPermanentDelete(c.id, c.name); }}
                  style={{ fontSize: 11, color: 'var(--red)' }}
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

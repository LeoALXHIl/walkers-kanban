import { useMemo, useState } from 'react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { allClients, type ClientSummary } from '@/services/clients';
import { pickHashColor } from '@/services/colors';
import { fmt } from '@/services/storage';

type SortKey = 'recent' | 'cards' | 'name' | 'overdue';

export function ClientsView() {
  const data = useData(s => s.data);
  const openClientDetail = useUI(s => s.openClientDetail);
  const openNewCard = useUI(s => s.openNewCard);
  const openNewClientModal = useUI(s => s.openNewClientModal);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [showArchived, setShowArchived] = useState(false);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const clients = useMemo(() => {
    let list = allClients(data);
    if (!showArchived) list = list.filter(c => !c.profile?.archived);
    if (selectedTagIds.length > 0) {
      list = list.filter(c => {
        const ids = c.profile?.tagIds || [];
        return selectedTagIds.every(t => ids.includes(t));
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      const tagNamesById = new Map(data.tags.map(t => [t.id, t.name.toLowerCase()]));
      list = list.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        (c.profile?.phone || '').includes(q) ||
        (c.profile?.email || '').toLowerCase().includes(q) ||
        (c.profile?.tagIds || []).some(id => (tagNamesById.get(id) || '').includes(q))
      );
    }
    const sorters: Record<SortKey, (a: ClientSummary, b: ClientSummary) => number> = {
      recent: (a, b) => b.lastActivity - a.lastActivity,
      cards: (a, b) => b.totalCards - a.totalCards,
      name: (a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'),
      overdue: (a, b) => b.overdueCards - a.overdueCards || b.activeCards - a.activeCards
    };
    return list.sort(sorters[sort]);
  }, [data, query, sort, showArchived, selectedTagIds]);

  // Compute tag usage among clients for the sidebar filter
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allClients(data).filter(c => showArchived || !c.profile?.archived).forEach(c => {
      (c.profile?.tagIds || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    });
    return counts;
  }, [data, showArchived]);
  const usedTags = data.tags.filter(t => tagCounts[t.id]);

  const totalActive = clients.filter(c => c.activeCards > 0).length;
  const totalOverdue = clients.filter(c => c.overdueCards > 0).length;

  return (
    <div className="clients-view">
      <div className="clients-summary">
        <div className="clients-stat">
          <div className="clients-stat-n">{clients.length}</div>
          <div className="clients-stat-label">Clientes</div>
        </div>
        <div className="clients-stat">
          <div className="clients-stat-n">{totalActive}</div>
          <div className="clients-stat-label">Com cards ativos</div>
        </div>
        <div className="clients-stat">
          <div className="clients-stat-n" style={{ color: totalOverdue > 0 ? 'var(--red)' : 'var(--text)' }}>{totalOverdue}</div>
          <div className="clients-stat-label">Com atrasos</div>
        </div>
      </div>

      <div className="clients-toolbar">
        <input
          className="search-input"
          placeholder="Buscar cliente, tag, email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: 240 }}
        />
        <select className="filter-sel" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="recent">Mais recentes</option>
          <option value="cards">Mais cards</option>
          <option value="overdue">Mais atrasos</option>
          <option value="name">Ordem alfabética</option>
        </select>
        <label className="chk-lbl" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Mostrar arquivados
        </label>
        <button className="btn btn-primary" onClick={openNewClientModal}>
          + Novo cliente
        </button>
      </div>

      {usedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 0 8px', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 4 }}>
            Filtrar por tag:
          </span>
          {usedTags.map(t => {
            const selected = selectedTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                className="tag-chip"
                onClick={() => setSelectedTagIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                style={{
                  background: selected ? `${t.color}33` : `${t.color}11`,
                  color: t.color,
                  border: `1px solid ${selected ? t.color : t.color + '55'}`,
                  cursor: 'pointer',
                  fontWeight: selected ? 600 : 400
                }}
              >
                {t.name} <span style={{ opacity: .6, marginLeft: 4 }}>{tagCounts[t.id]}</span>
              </button>
            );
          })}
          {selectedTagIds.length > 0 && (
            <button
              className="tag-chip"
              onClick={() => setSelectedTagIds([])}
              style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >Limpar</button>
          )}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="board-empty">
          <div className="board-empty-emoji">👥</div>
          <h2 className="board-empty-title">Nenhum cliente ainda</h2>
          <p className="board-empty-sub">Cadastre um cliente diretamente ou crie um card com nome do cliente — ele aparece aqui automaticamente.</p>
          <div className="board-empty-actions">
            <button className="btn btn-primary" onClick={openNewClientModal}>+ Novo cliente</button>
            <button className="btn btn-ghost" onClick={() => openNewCard()}>+ Criar card</button>
          </div>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map(c => <ClientCard key={c.key} client={c} onOpen={() => openClientDetail(c.key)} />)}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, onOpen }: { client: ClientSummary; onOpen: () => void }) {
  const initials = client.displayName.slice(0, 2).toUpperCase();
  const bg = pickHashColor(client.displayName);
  const isArchived = !!client.profile?.archived;
  const allTags = useData(s => s.data.tags);
  const myTags = (client.profile?.tagIds || []).map(id => allTags.find(t => t.id === id)).filter(Boolean) as Array<{ id: string; name: string; color: string }>;

  return (
    <div className={`client-card${isArchived ? ' archived' : ''}`} onClick={onOpen}>
      <div className="client-avatar" style={{ background: bg }}>{initials}</div>
      <div className="client-body">
        <div className="client-name">{client.displayName}</div>
        <div className="client-meta">
          {client.totalCards} card{client.totalCards === 1 ? '' : 's'}
          {client.activeCards > 0 && <> · {client.activeCards} ativo{client.activeCards === 1 ? '' : 's'}</>}
          {client.lastActivity > 0 && <> · {fmt(client.lastActivity)}</>}
        </div>
        <div className="client-badges">
          {client.overdueCards > 0 && (
            <span className="badge bhigh">{client.overdueCards} atrasado{client.overdueCards === 1 ? '' : 's'}</span>
          )}
          {client.topPriority === 'high' && client.activeCards > 0 && (
            <span className="badge bhigh">🔴 Alta</span>
          )}
          {client.platforms.includes('wpp') && <span className="badge bwpp">WhatsApp</span>}
          {client.platforms.includes('insta') && <span className="badge binsta">Insta</span>}
          {myTags.slice(0, 3).map(t => (
            <span key={t.id} className="tag-chip" style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}55`, fontSize: 10, padding: '2px 7px' }}>{t.name}</span>
          ))}
          {myTags.length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{myTags.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  );
}

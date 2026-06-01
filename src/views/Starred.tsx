import { useData, toggleStarCard } from '@/store/data';
import { useUI } from '@/store/ui';
import { pickHashColor } from '@/services/colors';
import { dueInfo } from '@/services/storage';
import { timeSince } from '@/services/time';
import { toast } from '@/services/toast';

export function StarredView() {
  const cards = useData(s => s.data.cards);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const cols = useData(s => s.data.cols);
  const openDetail = useUI(s => s.openDetail);

  const list = cards
    .filter(c => c.starred && !c.archived)
    .filter(c => !c.boardId || c.boardId === activeBoardId)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (list.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-emoji">⭐</div>
        <h2 className="board-empty-title">Sem favoritos ainda</h2>
        <p className="board-empty-sub">
          Clique na estrela ★ no canto de qualquer card pra adicionar aqui.
          Use pra cards prioritários ou que você quer acompanhar de perto.
        </p>
      </div>
    );
  }

  return (
    <div className="snooze-list">
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
        {list.length} favorito{list.length === 1 ? '' : 's'}
      </div>
      {list.map(c => {
        const col = cols.find(x => x.id === c.cid);
        const di = dueInfo(c.due);
        return (
          <div key={c.id} className="snooze-row" style={{ borderLeftColor: '#fbbf24' }}>
            <div style={{ fontSize: 18 }}>⭐</div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openDetail(c.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color || pickHashColor(c.name) }} />
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                {col?.name || '—'} · {timeSince(c.ts)}
                {di && <> · <span style={{ color: di.cls === 'due-late' ? 'var(--red)' : 'var(--amber)' }}>{di.label}</span></>}
              </div>
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 14, padding: '5px 8px' }}
              onClick={() => {
                toggleStarCard(c.id);
                toast.info('Removido dos favoritos', { durationMs: 1500 });
              }}
              title="Desfavoritar"
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}

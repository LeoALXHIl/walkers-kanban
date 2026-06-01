import { useData, snoozeCard } from '@/store/data';
import { useUI } from '@/store/ui';
import { pickHashColor } from '@/services/colors';
import { fmt } from '@/services/storage';
import { toast } from '@/services/toast';

export function SnoozedView() {
  const cards = useData(s => s.data.cards);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const openDetail = useUI(s => s.openDetail);

  const now = Date.now();
  const list = cards
    .filter(c => c.snoozedUntil && c.snoozedUntil > now)
    .filter(c => !c.boardId || c.boardId === activeBoardId)
    .sort((a, b) => (a.snoozedUntil || 0) - (b.snoozedUntil || 0));

  if (list.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-emoji">💤</div>
        <h2 className="board-empty-title">Nenhum card adormecido</h2>
        <p className="board-empty-sub">
          Use o botão <strong>😴 Snooze</strong> no detalhe de um card pra escondê-lo até uma data.
          Eles aparecem aqui prontos pra serem acordados.
        </p>
      </div>
    );
  }

  return (
    <div className="snooze-list">
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
        {list.length} card{list.length === 1 ? '' : 's'} adormecido{list.length === 1 ? '' : 's'}
      </div>
      {list.map(c => {
        const t = c.snoozedUntil!;
        const dateStr = new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
        const daysAway = Math.ceil((t - now) / 86400000);
        return (
          <div key={c.id} className="snooze-row">
            <div className="snooze-when">
              <div>{dateStr}</div>
              <div style={{ color: 'var(--text3)' }}>em {daysAway}d</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openDetail(c.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color || pickHashColor(c.name) }} />
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>criado em {fmt(c.ts)}</div>
            </div>
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '5px 11px' }}
              onClick={() => {
                snoozeCard(c.id, null);
                toast.success(`"${c.name}" acordado`, { icon: '☀️', durationMs: 2000 });
              }}
            >☀️ Acordar</button>
          </div>
        );
      })}
    </div>
  );
}

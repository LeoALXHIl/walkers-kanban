import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useFilteredCards } from '@/hooks/useFilteredCards';
import { PLAT_LABEL, PLAT_CLASS, PLAT_ICON_HTML, PRIO_LABEL, PRIO_CLASS } from '@/services/icons';
import { dueInfo } from '@/services/storage';

export function ListView() {
  const allCols = useData(s => s.data.cols);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const cols = allCols.filter(c => !c.boardId || c.boardId === activeBoardId);
  const cards = useFilteredCards();
  const openDetail = useUI(s => s.openDetail);

  if (cards.length === 0) {
    return (
      <div className="list-view">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Nenhum card.</div>
      </div>
    );
  }

  return (
    <div className="list-view">
      {cols.map(col => {
        const colCards = cards.filter(c => c.cid === col.id);
        if (!colCards.length) return null;
        return (
          <div key={col.id}>
            <div className="list-gh" style={{ color: col.color }}>{col.name} · {colCards.length}</div>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Prioridade</th>
                  <th>Plataformas</th>
                  <th>Responsável</th>
                  <th>Vencimento</th>
                  <th>Subtarefas</th>
                </tr>
              </thead>
              <tbody>
                {colCards.map(c => {
                  const pc = PRIO_CLASS[c.prio];
                  const pl = PRIO_LABEL[c.prio];
                  const di = dueInfo(c.due);
                  const subT = c.subtasks.length;
                  const subD = c.subtasks.filter(s => s.done).length;
                  return (
                    <tr key={c.id} onClick={() => openDetail(c.id)}>
                      <td>
                        <span className="list-cardname" style={{ ['--lc' as any]: c.color || '#7c5cfc' }}>{c.name}</span>
                      </td>
                      <td><span className={`badge ${pc}`}>{pl}</span></td>
                      <td>
                        {c.plat.length === 0 ? <span style={{ color: 'var(--text3)' }}>—</span> :
                          c.plat.map(p => (
                            <span key={p} className={`badge ${PLAT_CLASS[p]}`} style={{ marginRight: 3 }}>
                              <span dangerouslySetInnerHTML={{ __html: PLAT_ICON_HTML[p] }} title={PLAT_LABEL[p]} />
                            </span>
                          ))}
                      </td>
                      <td>{c.assignee || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td>{di ? <span className={`card-due ${di.cls}`}>{di.label}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td>{subT > 0 ? `${subD}/${subT}` : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

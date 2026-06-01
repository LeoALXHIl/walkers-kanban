import { useData } from '@/store/data';
import { useMemo } from 'react';
import { AnimatedNumber } from '@/components/AnimatedNumber';

export function DashboardView() {
  const data = useData(s => s.data);
  const fbConnected = useData(s => s.fbConnected);

  const m = useMemo(() => {
    const cards = data.cards.filter(c => !c.archived && (!c.boardId || c.boardId === data.activeBoardId));
    const cols = data.cols.filter(c => !c.boardId || c.boardId === data.activeBoardId);
    const total = cards.length;
    const byCol = cols.map(c => ({ name: c.name, color: c.color, n: cards.filter(x => x.cid === c.id).length }));
    const byPrio = { high: 0, med: 0, low: 0 };
    cards.forEach(c => { byPrio[c.prio || 'med']++; });
    const now = Date.now();
    const overdue = cards.filter(c => c.due && new Date(c.due + 'T00:00:00').getTime() < now).length;
    const lastCol = cols[cols.length - 1];
    const done = lastCol ? cards.filter(c => c.cid === lastCol.id).length : 0;
    const pct = total ? Math.round(done / total * 100) : 0;
    const withSub = cards.filter(c => c.subtasks.length > 0).length;
    const maxCol = Math.max(1, ...byCol.map(c => c.n));
    return { total, byCol, byPrio, overdue, lastCol, done, pct, withSub, maxCol };
  }, [data]);

  return (
    <div className="dash">
      <div className="dash-grid">
        <DashStat label="Total de cards" value={<AnimatedNumber value={m.total} />} color="var(--accent)" />
        <DashStat label="Concluídos" value={<><AnimatedNumber value={m.done} /> ({m.pct}%)</>} color="var(--green)" />
        <DashStat label="Atrasados" value={<AnimatedNumber value={m.overdue} />} color={m.overdue > 0 ? 'var(--red)' : 'var(--text3)'} />
        <DashStat label="Com subtarefas" value={<AnimatedNumber value={m.withSub} />} color="var(--sky)" />
      </div>
      <div className="dash-charts">
        <div className="dash-chart">
          <div className="dash-chart-title">Cards por coluna</div>
          {m.byCol.map(c => (
            <div key={c.name} className="bar-row">
              <div className="bar-label">
                <span>{c.name}</span>
                <span>{c.n}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${Math.round((c.n / m.maxCol) * 100)}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>
        <div className="dash-chart">
          <div className="dash-chart-title">Por prioridade</div>
          {([['high', 'Alta', 'var(--red)'], ['med', 'Média', 'var(--amber)'], ['low', 'Baixa', 'var(--green)']] as const).map(([k, l, c]) => (
            <div key={k} className="bar-row">
              <div className="bar-label">
                <span>{l}</span>
                <span>{m.byPrio[k]}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${m.total ? Math.round((m.byPrio[k] / m.total) * 100) : 0}%`, background: c }} />
              </div>
            </div>
          ))}
          <div className="dash-chart-title" style={{ marginTop: 18 }}>Progresso geral</div>
          <div className="donut-wrap">
            <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: 76, height: 76, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg4)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--green)" strokeWidth="3" strokeDasharray={`${m.pct} ${100 - m.pct}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600 }}>
                {m.pct}%
              </div>
            </div>
            <div className="donut-info">
              {m.done} de {m.total} cards<br />na última coluna<br />({m.lastCol?.name || '—'})
            </div>
          </div>
          <div className="dash-chart-title" style={{ marginTop: 18 }}>Firebase</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Status: <span style={{ color: fbConnected ? 'var(--green)' : 'var(--red)' }}>{fbConnected ? '✓ Conectado' : '✗ Offline'}</span><br />
            Projeto: <code style={{ fontSize: 9 }}>walkerskambam</code><br />
            Dados: Firestore / users / &#123;uid&#125; / kanban / main
          </div>
        </div>
      </div>
    </div>
  );
}

function DashStat({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="dash-card">
      <div className="dash-card-label">{label}</div>
      <div className="dash-card-val" style={{ color }}>{value}</div>
    </div>
  );
}

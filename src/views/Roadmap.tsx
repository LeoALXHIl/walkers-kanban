import { useMemo, useState } from 'react';
import { useData, updateCard } from '@/store/data';
import { useUI } from '@/store/ui';
import { usePermissions } from '@/services/permissions';
import { pickHashColor } from '@/services/colors';
import { fmt } from '@/services/storage';

type RangeKey = '30' | '90' | '180';
const RANGES: Array<{ k: RangeKey; days: number; label: string }> = [
  { k: '30',  days: 30,  label: '30 dias' },
  { k: '90',  days: 90,  label: '90 dias' },
  { k: '180', days: 180, label: '6 meses' }
];

export function RoadmapView() {
  const data = useData(s => s.data);
  const openDetail = useUI(s => s.openDetail);
  const { canEdit } = usePermissions();
  const [range, setRange] = useState<RangeKey>('90');
  const days = RANGES.find(r => r.k === range)!.days;

  const activeBoardId = data.activeBoardId;
  const boardCards = useMemo(
    () => data.cards.filter(c => !c.archived && (!c.boardId || c.boardId === activeBoardId)),
    [data, activeBoardId]
  );

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const start = today;
  const end = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + days); return d; }, [today, days]);

  // Cards com due dentro do range
  const cardsInRange = useMemo(() => {
    return boardCards
      .filter(c => c.due)
      .map(c => ({ card: c, due: new Date(c.due! + 'T00:00:00') }))
      .filter(({ due }) => due >= start && due <= end)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [boardCards, start, end]);

  // Cards sem due (separados embaixo)
  const cardsNoDue = useMemo(
    () => boardCards.filter(c => !c.due).slice(0, 20),
    [boardCards]
  );

  // Calcular posição na timeline
  const totalMs = end.getTime() - start.getTime();
  const xFor = (d: Date) => ((d.getTime() - start.getTime()) / totalMs) * 100;

  // Marks (semanas, meses)
  const marks = useMemo(() => {
    const out: Array<{ x: number; label: string; major: boolean }> = [];
    const cursor = new Date(start);
    let i = 0;
    while (cursor <= end && i < 50) {
      const isMonth = cursor.getDate() === 1;
      out.push({
        x: xFor(new Date(cursor)),
        label: cursor.toLocaleDateString('pt-BR', isMonth ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }),
        major: isMonth
      });
      cursor.setDate(cursor.getDate() + (days <= 30 ? 7 : days <= 90 ? 14 : 30));
      i++;
    }
    return out;
  }, [start, end, days]);

  if (boardCards.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-emoji">🛣️</div>
        <h2 className="board-empty-title">Sem cards pra colocar no roadmap</h2>
        <p className="board-empty-sub">
          Cards com data de vencimento aparecem aqui na timeline. Útil pra ver carga de trabalho dos próximos 3 meses.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {cardsInRange.length} card(s) com vencimento nos próximos {days} dias · {cardsNoDue.length} sem data
          </div>
        </div>
        <div className="density-toggle">
          {RANGES.map(r => (
            <button key={r.k} className={`density-btn${range === r.k ? ' active' : ''}`} onClick={() => setRange(r.k)}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16, overflowX: 'auto' }}>
        <div style={{ minWidth: 700, position: 'relative' }}>
          {/* Time axis */}
          <div style={{ position: 'relative', height: 22, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
            {marks.map((m, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute', left: `${m.x}%`, top: 0, bottom: 0,
                  borderLeft: `1px ${m.major ? 'solid' : 'dashed'} var(--border)`,
                  paddingLeft: 4, fontSize: m.major ? 10 : 9, color: m.major ? 'var(--text2)' : 'var(--text3)',
                  fontWeight: m.major ? 600 : 400
                }}
              >{m.label}</div>
            ))}
            {/* Today marker */}
            <div style={{
              position: 'absolute', left: '0%', top: -2, bottom: -8,
              width: 2, background: 'var(--red)'
            }} title="Hoje" />
            <div style={{
              position: 'absolute', left: '0%', top: -10,
              transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, color: 'var(--red)',
              background: 'var(--bg2)', padding: '0 4px'
            }}>HOJE</div>
          </div>

          {/* Card bars */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {cardsInRange.map(({ card, due }, idx) => {
              const x = xFor(due);
              const color = card.color || pickHashColor(card.name);
              const isOverdue = due < today;
              return (
                <div
                  key={card.id}
                  onClick={() => openDetail(card.id)}
                  style={{
                    position: 'relative', height: 28, cursor: 'pointer',
                    background: 'var(--bg3)', borderRadius: 4, padding: '0 8px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: '1px solid var(--border)'
                  }}
                  title={`${card.name} · ${fmt(due.getTime())}`}
                >
                  {/* Bar at the due position */}
                  <div style={{
                    position: 'absolute', left: `${Math.max(0, x)}%`, top: '50%', transform: 'translateY(-50%)',
                    width: 16, height: 16, borderRadius: 4, background: color,
                    boxShadow: `0 0 0 2px var(--bg3)`,
                    zIndex: 2
                  }} />
                  <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 24, color: isOverdue ? 'var(--red)' : 'var(--text)' }}>
                    {card.name}
                  </span>
                  <span style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--text3)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>
                    {due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sem due */}
      {cardsNoDue.length > 0 && (
        <div>
          <div className="sb-section" style={{ marginBottom: 8 }}>Sem data ({cardsNoDue.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cardsNoDue.map(c => (
              <div
                key={c.id}
                onClick={() => openDetail(c.id)}
                style={{
                  padding: '4px 9px', fontSize: 11, cursor: 'pointer',
                  background: 'var(--bg3)', borderLeft: `3px solid ${c.color || pickHashColor(c.name)}`,
                  borderRadius: 4
                }}
              >{c.name}</div>
            ))}
          </div>
          {canEdit && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
              💡 Adicione data de vencimento nesses cards pra eles aparecerem na timeline acima.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

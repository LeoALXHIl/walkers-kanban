import { useMemo, useState } from 'react';
import type { AppData } from '@/types';

interface Props { data: AppData; }

const RANGES = [
  { days: 7,  label: '7d'  },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' }
];

export function BurndownChart({ data }: Props) {
  const [range, setRange] = useState(30);
  const W = 720;
  const H = 200;
  const PAD = { top: 20, right: 16, bottom: 30, left: 36 };

  const points = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeBoardId = data.activeBoardId;
    const boardCards = data.cards.filter(c => !c.boardId || c.boardId === activeBoardId);
    const lastColId = data.cols.length ? data.cols[data.cols.length - 1].id : null;

    const days: Array<{ date: Date; key: string; remaining: number; created: number; done: number }> = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: d, key, remaining: 0, created: 0, done: 0 });
    }

    // For each day, calculate cards that existed AND weren't done by that day's EOD
    const eodOf = (d: Date) => { const t = new Date(d); t.setHours(23, 59, 59, 999); return t.getTime(); };
    days.forEach(d => {
      const cutoff = eodOf(d.date);
      const existed = boardCards.filter(c => (c.ts || 0) <= cutoff);
      // "remaining" = ainda não concluído até essa data
      // Aproximação: card.cid === lastColId é "feito"; tentamos usar a última comment como proxy de quando completou
      const remaining = existed.filter(c => {
        if (c.cid !== lastColId) return true; // not done yet (in current state)
        // If it IS in done column, check if it was moved there before cutoff
        // Use latest comment as proxy of activity ts
        const lastComment = (c.comments || []).slice(-1)[0]?.ts || c.ts;
        return lastComment > cutoff; // wasn't done yet by cutoff
      });
      d.remaining = remaining.length;
    });

    // Activity from data.activity
    if (data.activity) {
      days.forEach(d => {
        const a = data.activity![d.key];
        if (a) {
          d.created = a.cardsCreated || 0;
          d.done = a.cardsCompleted || 0;
        }
      });
    }

    return days;
  }, [data, range]);

  const maxY = Math.max(1, ...points.map(p => p.remaining));
  const xStep = (W - PAD.left - PAD.right) / Math.max(1, points.length - 1);
  const yScale = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / maxY);

  // Build ideal line: starts at first remaining value, decreases linearly to 0
  const firstRemaining = points[0]?.remaining || 0;
  const idealPath = points.length > 1
    ? points.map((_, i) => {
        const ideal = firstRemaining * (1 - i / (points.length - 1));
        return `${i === 0 ? 'M' : 'L'} ${PAD.left + i * xStep} ${yScale(ideal)}`;
      }).join(' ')
    : '';

  const realPath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${PAD.left + i * xStep} ${yScale(p.remaining)}`
  ).join(' ');

  // Y axis ticks
  const yTicks = [0, Math.ceil(maxY / 2), maxY];

  return (
    <div className="dash-chart">
      <div className="dash-chart-title" style={{ display: 'flex', alignItems: 'center' }}>
        <span>📉 Burndown — cards em aberto</span>
        <div className="density-toggle" style={{ marginLeft: 'auto' }}>
          {RANGES.map(r => (
            <button
              key={r.days}
              className={`density-btn${range === r.days ? ' active' : ''}`}
              onClick={() => setRange(r.days)}
            >{r.label}</button>
          ))}
        </div>
      </div>
      {points.every(p => p.remaining === 0) ? (
        <div style={{ padding: 20, color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
          Sem dados suficientes nesse range.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
          {/* grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yScale(t)} x2={W - PAD.right} y2={yScale(t)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={PAD.left - 6} y={yScale(t) + 4} fontSize={10} fill="var(--text3)" textAnchor="end">{t}</text>
            </g>
          ))}
          {/* X axis labels */}
          {points.filter((_, i) => i % Math.ceil(points.length / 8) === 0).map((p, i) => {
            const idx = points.indexOf(p);
            return (
              <text
                key={i}
                x={PAD.left + idx * xStep}
                y={H - PAD.bottom + 16}
                fontSize={9}
                fill="var(--text3)"
                textAnchor="middle"
              >{p.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</text>
            );
          })}
          {/* Ideal line (tracejada) */}
          <path d={idealPath} stroke="var(--text3)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
          {/* Real area + line */}
          <path d={realPath + ` L ${PAD.left + (points.length - 1) * xStep} ${yScale(0)} L ${PAD.left} ${yScale(0)} Z`}
            fill="url(#burnGrad)" fillOpacity="0.18" />
          <path d={realPath} stroke="var(--accent)" strokeWidth="2.5" fill="none" />
          {/* Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={PAD.left + i * xStep}
              cy={yScale(p.remaining)}
              r={2.5}
              fill="var(--accent)"
            >
              <title>{p.date.toLocaleDateString('pt-BR')} · {p.remaining} aberto(s)</title>
            </circle>
          ))}
          <defs>
            <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      )}
      <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 16, marginTop: 6 }}>
        <span>━ Real (cards abertos)</span>
        <span style={{ color: 'var(--text3)' }}>┄ Ideal (decrescimento linear)</span>
      </div>
    </div>
  );
}

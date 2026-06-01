import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/data';
import { getSnapshots, captureSnapshot } from '@/services/flowSnapshots';

const RANGES = [
  { days: 7,  label: '7d'  },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' }
];

export function CumulativeFlowChart() {
  const data = useData(s => s.data);
  const [range, setRange] = useState(30);

  // Garantir que tem snapshot pra hoje
  useEffect(() => { captureSnapshot(data); }, [data]);

  const bid = data.activeBoardId;
  const cols = useMemo(
    () => data.cols.filter(c => !c.boardId || c.boardId === bid),
    [data.cols, bid]
  );

  const snaps = bid ? getSnapshots(bid, range) : [];

  const W = 720;
  const H = 220;
  const PAD = { top: 20, right: 16, bottom: 30, left: 36 };

  if (snaps.length < 2) {
    return (
      <div className="dash-chart">
        <div className="dash-chart-title">📊 Cumulative Flow</div>
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📈</div>
          Coletando dados… A partir de amanhã o gráfico começa a mostrar a evolução do board.
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
            (Snapshots diários do quanto cada coluna tem)
          </div>
        </div>
      </div>
    );
  }

  // Compute stacked data
  const xStep = (W - PAD.left - PAD.right) / Math.max(1, snaps.length - 1);
  const maxY = Math.max(1, ...snaps.map(s => Object.values(s.counts).reduce((a, b) => a + b, 0)));
  const yScale = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / maxY);

  // Per-column areas
  const colsToShow = cols.filter(c => snaps.some(s => (s.counts[c.id] || 0) > 0));
  const stackedPaths: Array<{ col: typeof cols[0]; path: string }> = [];
  // Bottom-up stacking: each column starts on top of previous
  snaps.forEach((s, idx) => {
    let bottom = 0;
    colsToShow.forEach(col => {
      const value = s.counts[col.id] || 0;
      const top = bottom + value;
      if (idx === 0) {
        stackedPaths.push({ col, path: `M ${PAD.left} ${yScale(top)}` });
      }
      bottom = top;
    });
  });
  // Re-build properly: iterate columns, for each column build the polygon path
  const polygons = colsToShow.map((col, ci) => {
    const points: Array<[number, number]> = [];
    // top line (left to right): cumulative sum INCLUDING this column
    snaps.forEach((s, i) => {
      let cum = 0;
      for (let j = 0; j <= ci; j++) cum += s.counts[colsToShow[j].id] || 0;
      points.push([PAD.left + i * xStep, yScale(cum)]);
    });
    // bottom line (right to left): cumulative sum EXCLUDING this column
    for (let i = snaps.length - 1; i >= 0; i--) {
      const s = snaps[i];
      let cum = 0;
      for (let j = 0; j < ci; j++) cum += s.counts[colsToShow[j].id] || 0;
      points.push([PAD.left + i * xStep, yScale(cum)]);
    }
    const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
    return { col, path };
  });

  const yTicks = [0, Math.ceil(maxY / 2), maxY];

  return (
    <div className="dash-chart">
      <div className="dash-chart-title" style={{ display: 'flex', alignItems: 'center' }}>
        <span>📊 Cumulative Flow — work in progress</span>
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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yScale(t)} x2={W - PAD.right} y2={yScale(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={PAD.left - 6} y={yScale(t) + 4} fontSize={10} fill="var(--text3)" textAnchor="end">{t}</text>
          </g>
        ))}
        {/* X axis labels */}
        {snaps.filter((_, i) => i % Math.ceil(snaps.length / 8) === 0).map((s, i) => {
          const idx = snaps.indexOf(s);
          const d = new Date(s.date + 'T00:00:00');
          return (
            <text
              key={i}
              x={PAD.left + idx * xStep}
              y={H - PAD.bottom + 16}
              fontSize={9}
              fill="var(--text3)"
              textAnchor="middle"
            >{d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</text>
          );
        })}
        {/* Stacked area per column */}
        {polygons.map((p, i) => (
          <path
            key={i}
            d={p.path}
            fill={p.col.color}
            fillOpacity="0.55"
            stroke={p.col.color}
            strokeOpacity="0.85"
            strokeWidth="1"
          >
            <title>{p.col.name}</title>
          </path>
        ))}
      </svg>
      <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {colsToShow.map(c => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}

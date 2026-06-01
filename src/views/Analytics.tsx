import { useMemo } from 'react';
import { useData } from '@/store/data';
import {
  funnel, avgTimeInColumns, productivityHeatmap, topClients,
  byPlatform, weekOverWeek, detectBottlenecks
} from '@/services/analytics';
import { aggregate } from '@/services/streak';
import { BurndownChart } from '@/components/BurndownChart';
import { CumulativeFlowChart } from '@/components/CumulativeFlowChart';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function AnalyticsView() {
  const fullData = useData(s => s.data);
  // Scope analytics to the active board: build a derived AppData with only this board's cards/cols
  const data = useMemo(() => {
    const bid = fullData.activeBoardId;
    if (!bid) return fullData;
    return {
      ...fullData,
      cards: fullData.cards.filter(c => !c.boardId || c.boardId === bid),
      cols: fullData.cols.filter(c => !c.boardId || c.boardId === bid)
    };
  }, [fullData]);

  const stages = useMemo(() => funnel(data), [data]);
  const times = useMemo(() => avgTimeInColumns(data), [data]);
  const heat = useMemo(() => productivityHeatmap(data), [data]);
  const top = useMemo(() => topClients(data, 5), [data]);
  const plats = useMemo(() => byPlatform(data), [data]);
  const wow = useMemo(() => weekOverWeek(data), [data]);
  const bottlenecks = useMemo(() => detectBottlenecks(data), [data]);
  const a7 = useMemo(() => aggregate(data, 7), [data]);
  const a30 = useMemo(() => aggregate(data, 30), [data]);

  const heatMax = Math.max(1, ...heat.flat());

  return (
    <div className="analytics-view">
      {/* ─── Trends week-over-week ─── */}
      <div className="dash-grid">
        <TrendStat label="Atividade · 7d" current={wow.total.current} delta={wow.total.deltaPct} />
        <TrendStat label="Concluídos · 7d" current={wow.completed.current} delta={wow.completed.deltaPct} accent="var(--green)" />
        <TrendStat label="Criados · 7d" current={wow.created.current} delta={wow.created.deltaPct} accent="var(--accent)" />
        <TrendStat label="Dias ativos · 30d" current={a30.activeDays} delta={0} accent="var(--sky)" hideDelta />
      </div>

      {/* ─── DV-2: Burndown ─── */}
      <BurndownChart data={data} />

      {/* ─── DV-3: Cumulative Flow ─── */}
      <CumulativeFlowChart />

      {/* ─── Funil + tempo médio ─── */}
      <div className="analytics-row">
        <div className="dash-chart">
          <div className="dash-chart-title">Funil de cards por etapa</div>
          {stages.map(s => (
            <div key={s.colId} className="bar-row">
              <div className="bar-label">
                <span>{s.colName}</span>
                <span>{s.count} · {s.pctOfTotal}%</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${s.pctOfTotal}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="dash-chart">
          <div className="dash-chart-title">Tempo médio em cada coluna</div>
          {times.map(s => (
            <div key={s.colId} className="bar-row">
              <div className="bar-label">
                <span>{s.colName}</span>
                <span>{s.avgDaysFromCreation > 0 ? `${s.avgDaysFromCreation}d` : '—'} · {s.count}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${Math.min(100, s.avgDaysFromCreation * 5)}%`, background: s.avgDaysFromCreation > 7 ? 'var(--red)' : s.color }} />
              </div>
            </div>
          ))}
          {bottlenecks.length > 0 && (
            <div className="analytics-insight">
              ⚠️ <strong>Gargalo detectado:</strong> {bottlenecks.map(b => `${b.colName} (${b.avgDays}d)`).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* ─── Heatmap produtividade ─── */}
      <div className="dash-chart">
        <div className="dash-chart-title">Quando você cria cards · 7 dias × 24 horas</div>
        <div className="prod-heat">
          <div className="prod-heat-hours">
            <span></span>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="prod-heat-hour">{h % 6 === 0 ? `${h}h` : ''}</span>
            ))}
          </div>
          {heat.map((row, dow) => (
            <div key={dow} className="prod-heat-row">
              <span className="prod-heat-day">{DAY_LABELS[dow]}</span>
              {row.map((val, h) => (
                <div
                  key={h}
                  className="prod-heat-cell"
                  style={{ background: heatColor(val, heatMax) }}
                  title={`${DAY_LABELS[dow]} ${h}h: ${val} ${val === 1 ? 'card' : 'cards'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Top clientes + por plataforma ─── */}
      <div className="analytics-row">
        <div className="dash-chart">
          <div className="dash-chart-title">Top 5 clientes (por volume de cards)</div>
          {top.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: 14, textAlign: 'center' }}>Sem dados ainda.</div>
          ) : top.map(c => (
            <div key={c.displayName} className="bar-row">
              <div className="bar-label">
                <span>{c.displayName}</span>
                <span>{c.doneCards}/{c.totalCards} · {c.pct}%</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${c.pct}%`, background: c.pct >= 75 ? 'var(--green)' : 'var(--accent)' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="dash-chart">
          <div className="dash-chart-title">Por plataforma</div>
          {plats.map(p => (
            <div key={p.plat} className="bar-row">
              <div className="bar-label">
                <span>{p.label}</span>
                <span>{p.doneCount}/{p.count}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{
                  width: `${p.count > 0 ? Math.round(p.doneCount / p.count * 100) : 0}%`,
                  background: p.plat === 'wpp' ? '#25d366' : p.plat === 'insta' ? '#e4405f' : '#0084ff'
                }} />
              </div>
            </div>
          ))}
          <div className="analytics-insight">
            💡 7 dias: <strong>{a7.cardsCompleted}</strong> concluídos · 30 dias: <strong>{a30.cardsCompleted}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendStat({ label, current, delta, accent, hideDelta }: { label: string; current: number; delta: number; accent?: string; hideDelta?: boolean }) {
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const deltaColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text3)';
  return (
    <div className="dash-card">
      <div className="dash-card-label">{label}</div>
      <div className="dash-card-val" style={{ color: accent || 'var(--text)' }}>{current}</div>
      {!hideDelta && (
        <div className="trend-delta" style={{ color: deltaColor }}>
          {arrow} {delta > 0 ? '+' : ''}{delta}% vs semana anterior
        </div>
      )}
    </div>
  );
}

function heatColor(val: number, max: number): string {
  if (val === 0) return 'rgba(255,255,255,0.04)';
  const intensity = val / max;
  if (intensity < 0.25) return 'rgba(124,92,252,0.25)';
  if (intensity < 0.5) return 'rgba(124,92,252,0.5)';
  if (intensity < 0.75) return 'rgba(124,92,252,0.75)';
  return '#7c5cfc';
}

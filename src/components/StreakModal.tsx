import { useMemo } from 'react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { CloseIcon } from '@/services/icons';
import { aggregate, buildHeatmap, effectiveStreak, parseDay, streakAtRisk } from '@/services/streak';
import { ACHIEVEMENTS } from '@/services/achievements';

function fmtBR(dateStr: string): string {
  try {
    const d = parseDay(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch { return dateStr; }
}

function cellColor(count: number): string {
  if (count === 0) return 'var(--bg4)';
  if (count <= 2) return 'rgba(124,92,252,.25)';
  if (count <= 5) return 'rgba(124,92,252,.5)';
  if (count <= 10) return 'rgba(124,92,252,.75)';
  return 'var(--accent)';
}

export function StreakModal() {
  const open = useUI(s => s.streakModalOpen);
  const close = useUI(s => s.closeStreakModal);
  const openSnapshot = useUI(s => s.openSnapshot);
  const data = useData(s => s.data);

  const grid = useMemo(() => buildHeatmap(data, 12), [data.activity]);
  const stats30 = useMemo(() => aggregate(data, 30), [data.activity]);
  const stats7 = useMemo(() => aggregate(data, 7), [data.activity]);

  if (!open) return null;

  const streak = data.streak;
  const current = effectiveStreak(streak);
  const atRisk = streakAtRisk(streak);

  const dayLabels = ['Seg', '', 'Qua', '', 'Sex', '', 'Dom'];

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal streak-modal">
        <div className="streak-modal-head">
          <div className="streak-hero">
            <div className="streak-hero-flame">🔥</div>
            <div className="streak-hero-num">{current}</div>
            <div className="streak-hero-sub">
              {current === 0
                ? 'Você ainda não começou um streak — qualquer ação hoje conta'
                : current === 1
                  ? 'Primeiro dia do seu streak. Volte amanhã pra crescer.'
                  : atRisk
                    ? 'Streak em risco! Faça uma ação hoje pra manter.'
                    : `${current} dias seguidos no Walkers. Continue assim.`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" onClick={() => openSnapshot('streak')} title="Compartilhar streak" style={{ fontSize: 11, padding: '6px 10px' }}>
              📤 Compartilhar
            </button>
            <button className="detail-close" onClick={close} aria-label="Fechar">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="streak-stats">
          <div className="streak-stat">
            <div className="streak-stat-val">{streak?.longest || 0}</div>
            <div className="streak-stat-label">Melhor sequência</div>
          </div>
          <div className="streak-stat">
            <div className="streak-stat-val">{stats7.activeDays}</div>
            <div className="streak-stat-label">Dias ativos · 7d</div>
          </div>
          <div className="streak-stat">
            <div className="streak-stat-val">{stats30.activeDays}</div>
            <div className="streak-stat-label">Dias ativos · 30d</div>
          </div>
          <div className="streak-stat">
            <div className="streak-stat-val">{stats30.cardsCompleted}</div>
            <div className="streak-stat-label">Concluídos · 30d</div>
          </div>
        </div>

        <div className="streak-section">
          <div className="streak-section-title">Atividade · últimas 12 semanas</div>
          <div className="heatmap-wrap">
            <div className="heatmap-labels">
              {dayLabels.map((l, i) => <div key={i} className="heatmap-label">{l}</div>)}
            </div>
            <div className="heatmap-grid">
              {grid.map((week, ci) => (
                <div key={ci} className="heatmap-col">
                  {week.map(cell => (
                    <div
                      key={cell.date}
                      className={`heatmap-cell${cell.isToday ? ' is-today' : ''}`}
                      style={{ background: cellColor(cell.count) }}
                      title={`${fmtBR(cell.date)} · ${cell.count} ${cell.count === 1 ? 'ação' : 'ações'}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="heatmap-legend">
              <span>menos</span>
              {[0, 2, 5, 10, 15].map(n => (
                <div key={n} className="heatmap-cell" style={{ background: cellColor(n) }} />
              ))}
              <span>mais</span>
            </div>
          </div>
        </div>

        <div className="streak-section">
          <div className="streak-section-title">
            Conquistas · {Object.keys(data.achievements || {}).length}/{ACHIEVEMENTS.length}
          </div>
          <div className="ach-grid">
            {ACHIEVEMENTS.map(a => {
              const unlocked = !!(data.achievements && data.achievements[a.id]);
              return (
                <div
                  key={a.id}
                  className={`ach-cell${unlocked ? ' unlocked' : ' locked'}`}
                  title={`${a.name} — ${a.description}${unlocked ? '' : ' (bloqueado)'}`}
                >
                  <div className="ach-cell-emoji">{a.emoji}</div>
                  <div className="ach-cell-name">{a.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="streak-tips">
          <strong>Como manter o streak:</strong> qualquer ação no kanban hoje (criar card, mover, comentar, completar subtarefa) conta. O streak zera se você ficar 2 dias sem atividade.
        </div>
      </div>
    </div>
  );
}

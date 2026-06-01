import { useMemo } from 'react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { CloseIcon } from '@/services/icons';
import { aggregate, parseDay, todayStr } from '@/services/streak';

function fmtRange(): string {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function dayName(dateStr: string): string {
  try {
    const d = parseDay(dateStr);
    return d.toLocaleDateString('pt-BR', { weekday: 'long' });
  } catch { return dateStr; }
}

export function WeeklyWrapModal() {
  const open = useUI(s => s.wrapModalOpen);
  const close = useUI(s => s.closeWrapModal);
  const openSnapshot = useUI(s => s.openSnapshot);
  const data = useData(s => s.data);

  const stats = useMemo(() => aggregate(data, 7), [data.activity]);

  if (!open) return null;

  const headline =
    stats.cardsCompleted >= 5 ? '🚀 Semana foda!'
    : stats.cardsCompleted >= 1 ? '💪 Boa semana'
    : stats.total > 0 ? '⏳ Semana de organização'
    : '🌱 Semana de planejamento';

  const subline =
    stats.cardsCompleted === 0 && stats.total === 0
      ? 'Sem atividade nessa semana. Hora de retomar?'
      : `Você fez ${stats.total} interação${stats.total === 1 ? '' : 'ões'} nos últimos 7 dias.`;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal wrap-modal">
        <div className="wrap-head">
          <div>
            <div className="wrap-eyebrow">Walker Weekly · {fmtRange()}</div>
            <h2 className="wrap-title">{headline}</h2>
            <p className="wrap-sub">{subline}</p>
          </div>
          <button className="detail-close" onClick={close} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>

        <div className="wrap-stats">
          <WrapStat n={stats.cardsCompleted} label="Concluídos" emoji="✅" color="var(--green)" />
          <WrapStat n={stats.cardsCreated} label="Novos cards" emoji="✨" color="var(--accent)" />
          <WrapStat n={stats.cardsMoved} label="Movimentações" emoji="🔀" color="var(--sky)" />
          <WrapStat n={stats.comments} label="Comentários" emoji="💬" color="var(--amber)" />
        </div>

        <div className="wrap-highlights">
          {stats.topDay && stats.topDay.total > 0 && (
            <div className="wrap-highlight">
              <span className="wrap-highlight-emoji">🏆</span>
              <div>
                <div className="wrap-highlight-title">Dia mais produtivo</div>
                <div className="wrap-highlight-val">{dayName(stats.topDay.date)} — {stats.topDay.total} ações</div>
              </div>
            </div>
          )}
          <div className="wrap-highlight">
            <span className="wrap-highlight-emoji">📅</span>
            <div>
              <div className="wrap-highlight-title">Dias ativos</div>
              <div className="wrap-highlight-val">{stats.activeDays} de 7</div>
            </div>
          </div>
          {data.streak && (data.streak.current > 0) && (
            <div className="wrap-highlight">
              <span className="wrap-highlight-emoji">🔥</span>
              <div>
                <div className="wrap-highlight-title">Streak atual</div>
                <div className="wrap-highlight-val">{data.streak.current} {data.streak.current === 1 ? 'dia' : 'dias'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="wrap-foot">
          <button className="btn btn-ghost" onClick={() => openSnapshot('weekly')}>
            📤 Compartilhar
          </button>
          <button className="btn btn-primary" onClick={close}>Bora pra próxima semana</button>
        </div>
      </div>
    </div>
  );
}

function WrapStat({ n, label, emoji, color }: { n: number; label: string; emoji: string; color: string }) {
  return (
    <div className="wrap-stat">
      <div className="wrap-stat-emoji">{emoji}</div>
      <div className="wrap-stat-n" style={{ color }}>{n}</div>
      <div className="wrap-stat-label">{label}</div>
    </div>
  );
}

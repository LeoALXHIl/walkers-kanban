import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { effectiveStreak, streakAtRisk } from '@/services/streak';
import { ACHIEVEMENTS } from '@/services/achievements';

export function StreakBadge() {
  const streak = useData(s => s.data.streak);
  const achievements = useData(s => s.data.achievements);
  const openStreakModal = useUI(s => s.openStreakModal);
  const days = effectiveStreak(streak);
  const atRisk = streakAtRisk(streak);
  const unlocked = achievements ? Object.keys(achievements).length : 0;
  const total = ACHIEVEMENTS.length;

  const achHint = `· ${unlocked}/${total} conquistas`;

  if (days === 0 && !atRisk) {
    return (
      <button className="streak-pill streak-pill-cold" onClick={openStreakModal} title={`Comece um streak — feche um card hoje ${achHint}`}>
        <span className="streak-emoji">🔥</span>
        <span className="streak-count">0 dias</span>
        {unlocked > 0 && <span className="streak-count-sub">· {unlocked}🏆</span>}
      </button>
    );
  }

  return (
    <button
      className={`streak-pill${atRisk ? ' streak-pill-risk' : ''}`}
      onClick={openStreakModal}
      title={(atRisk ? 'Seu streak está em risco! Faça uma ação hoje pra manter.' : `Streak ativo: ${days} dia${days > 1 ? 's' : ''}`) + ' ' + achHint}
    >
      <span className="streak-emoji">🔥</span>
      <span className="streak-count">{days}</span>
      <span className="streak-count-sub">{days === 1 ? 'dia' : 'dias'}</span>
      {unlocked > 0 && <span className="streak-count-sub">· {unlocked}🏆</span>}
    </button>
  );
}

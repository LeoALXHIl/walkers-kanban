import { useEffect, useState } from 'react';
import { on } from '@/services/events';
import { confetti } from '@/services/confetti';
import { useUI } from '@/store/ui';
import type { UnlockedAchievement } from '@/services/achievements';

interface ToastItem extends UnlockedAchievement {
  uid: string;
}

const VISIBLE_MS = 5500;

export function AchievementToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const openSnapshot = useUI(s => s.openSnapshot);

  useEffect(() => {
    const off = on<UnlockedAchievement>('achievement:unlocked', (payload) => {
      const uid = `${payload.def.id}-${Date.now()}`;
      setItems(prev => [...prev, { ...payload, uid }]);
      // Tiny confetti burst for the milestone
      try { confetti(); } catch {}
      // Auto-dismiss
      setTimeout(() => {
        setItems(prev => prev.filter(t => t.uid !== uid));
      }, VISIBLE_MS);
    });
    return () => { off(); };
  }, []);

  if (!items.length) return null;

  return (
    <div className="ach-toast-stack" role="status" aria-live="polite">
      {items.map(item => (
        <div key={item.uid} className="ach-toast">
          <div className="ach-toast-emoji">{item.def.emoji}</div>
          <div className="ach-toast-body">
            <div className="ach-toast-eyebrow">Conquista desbloqueada</div>
            <div className="ach-toast-name">{item.def.name}</div>
            <div className="ach-toast-desc">{item.def.description}</div>
          </div>
          <div className="ach-toast-actions">
            <button
              className="ach-toast-btn"
              title="Compartilhar"
              onClick={(e) => { e.stopPropagation(); openSnapshot('achievement', item.def.id); }}
            >📤</button>
            <button
              className="ach-toast-btn"
              title="Dispensar"
              onClick={() => setItems(prev => prev.filter(t => t.uid !== item.uid))}
            >✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

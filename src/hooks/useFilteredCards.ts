import { useMemo } from 'react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';

export function useFilteredCards() {
  const cards = useData(s => s.data.cards);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const q = useUI(s => s.q);
  const plat = useUI(s => s.plat);
  const prio = useUI(s => s.prio);

  return useMemo(() => {
    const Q = q.trim().toLowerCase();
    const now = Date.now();
    const filtered = cards.filter(c => {
      if (activeBoardId && c.boardId && c.boardId !== activeBoardId) return false;
      if (c.archived) return false; // archived cards hidden everywhere except Archive view
      if (c.snoozedUntil && c.snoozedUntil > now) return false; // UX-18: hide snoozed cards
      if (Q && !(
        c.name.toLowerCase().includes(Q) ||
        (c.note || '').toLowerCase().includes(Q) ||
        (c.desc || '').toLowerCase().includes(Q)
      )) return false;
      if (plat && !(c.plat || []).includes(plat)) return false;
      if (prio && c.prio !== prio) return false;
      return true;
    });
    // Sort: pinned first, then manual order, then ts desc
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const orderA = a.order;
      const orderB = b.order;
      if (orderA != null && orderB != null) return orderA - orderB;
      if (orderA != null) return -1;
      if (orderB != null) return 1;
      return (b.ts || 0) - (a.ts || 0);
    });
  }, [cards, activeBoardId, q, plat, prio]);
}

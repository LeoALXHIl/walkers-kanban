import { create } from 'zustand';
import type { Notification } from '@/types';
import { genId } from '@/services/storage';

interface NotifState {
  items: Notification[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (n: Omit<Notification, 'id' | 'read'>) => void;
  markAllRead: () => void;
  open: (id: string) => Notification | null;
  clear: () => void;
}

async function persist(items: Notification[]) {
  try { await window.walkersAPI.saveNotifications(items); } catch (e) { console.error(e); }
}

export const useNotifications = create<NotifState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    try {
      const items = await window.walkersAPI.loadNotifications();
      set({ items: items || [], loaded: true });
    } catch {
      set({ items: [], loaded: true });
    }
  },
  add: (n) => {
    const next: Notification = { id: genId(), read: false, ...n };
    const items = [next, ...get().items].slice(0, 50);
    set({ items });
    persist(items);
  },
  markAllRead: () => {
    const items = get().items.map(n => ({ ...n, read: true }));
    set({ items });
    persist(items);
  },
  open: (id) => {
    const items = get().items.map(n => n.id === id ? { ...n, read: true } : n);
    set({ items });
    persist(items);
    return items.find(n => n.id === id) || null;
  },
  clear: () => { set({ items: [] }); persist([]); }
}));

export function unreadCount(): number {
  return useNotifications.getState().items.filter(n => !n.read).length;
}

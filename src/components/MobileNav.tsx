// Navegação mobile (≤768px): bottom nav fixa com as 4 views principais +
// botão "Menu" que abre a Sidebar como drawer. Em telas maiores nada disso
// renderiza visualmente (CSS esconde) — o estado vive aqui pra Topbar
// (hambúrguer) e Sidebar (fechar ao navegar) compartilharem.
import { create } from 'zustand';
import { useUI } from '@/store/ui';
import { KanbanIcon, ListIcon, CalendarIcon, ClientsIcon } from '@/services/icons';
import type { ViewKey } from '@/types';

export const useMobileNav = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({
  open: false,
  set: (v) => set({ open: v })
}));

const ITEMS: Array<{ key: ViewKey; label: string; icon: JSX.Element }> = [
  { key: 'kanban', label: 'Kanban', icon: <KanbanIcon /> },
  { key: 'list', label: 'Lista', icon: <ListIcon /> },
  { key: 'calendar', label: 'Agenda', icon: <CalendarIcon /> },
  { key: 'clients', label: 'Clientes', icon: <ClientsIcon /> }
];

export function MobileNav() {
  const view = useUI(s => s.view);
  const setView = useUI(s => s.setView);
  const drawerOpen = useMobileNav(s => s.open);
  const setDrawer = useMobileNav(s => s.set);

  return (
    <>
      {drawerOpen && <div className="mobile-backdrop" onClick={() => setDrawer(false)} />}
      <nav className="mobile-nav" aria-label="Navegação principal">
        {ITEMS.map(it => (
          <button
            key={it.key}
            className={`mn-item${view === it.key ? ' active' : ''}`}
            aria-current={view === it.key ? 'page' : undefined}
            onClick={() => { setView(it.key); setDrawer(false); }}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
        <button className={`mn-item${drawerOpen ? ' active' : ''}`} onClick={() => setDrawer(!drawerOpen)} aria-label="Abrir menu completo">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}

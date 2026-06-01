import { useUI } from '@/store/ui';
import { SearchIcon, PlusIcon, ColumnIcon } from '@/services/icons';
import { usePermissions } from '@/services/permissions';
import type { ViewKey, Platform, Priority } from '@/types';

const TITLES: Record<ViewKey, [string, string]> = {
  kanban: ['Kanban', 'Quadro de implementações'],
  list: ['Lista', 'Todos os cards em tabela'],
  dashboard: ['Dashboard', 'Visão geral e métricas'],
  inbox: ['Caixa de Entrada', 'Notificações e atividades'],
  mytasks: ['Minhas Tarefas', 'Cards e subtarefas atribuídos a você'],
  clients: ['Clientes', 'CRM dos seus clientes'],
  analytics: ['Analytics', 'Insights e tendências'],
  integrations: ['Integrações', 'Webhooks e conectores externos'],
  calendar: ['Calendar', 'Vencimentos + Google Calendar'],
  emails: ['Emails', 'Sua caixa Gmail aqui dentro'],
  archive: ['Arquivo', 'Cards arquivados — recupere ou apague permanentemente'],
  templates: ['Templates', 'Crie cards repetitivos com 1 clique'],
  snoozed: ['💤 Adormecidos', 'Cards escondidos até uma data — acorde a qualquer hora'],
  starred: ['⭐ Favoritos', 'Cards marcados como prioritários'],
  goals: ['🎯 Metas', 'Objetivos trimestrais e milestones do negócio'],
  sprints: ['🏃 Sprints', 'Ciclos de trabalho com prazo e meta clara'],
  roadmap: ['🛣️ Roadmap', 'Timeline dos próximos meses']
};

export function Topbar() {
  const view = useUI(s => s.view);
  const q = useUI(s => s.q);
  const setQ = useUI(s => s.setQ);
  const plat = useUI(s => s.plat);
  const setPlat = useUI(s => s.setPlat);
  const prio = useUI(s => s.prio);
  const setPrio = useUI(s => s.setPrio);
  const openNewCard = useUI(s => s.openNewCard);
  const openCol = useUI(s => s.openCol);
  const openPalette = useUI(s => s.openPalette);
  const openVoice = useUI(s => s.openVoice);
  const openOcr = useUI(s => s.openOcr);
  const openMeetingModal = useUI(s => s.openMeetingModal);
  const { canEdit, isViewer } = usePermissions();

  const [title, sub] = TITLES[view];
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  return (
    <div className="topbar">
      <div className="tb-left">
        <div>
          <div className="tb-view-title">{title}</div>
          <div className="tb-view-sub">{sub}</div>
        </div>
      </div>
      <div className="tb-right">
        <button className="btn btn-ghost cmdk-btn" onClick={openPalette} title="Command palette">
          <SearchIcon />
          <span>Comandos</span>
          <kbd className="cmdk-kbd">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <div className="search-wrap">
          <SearchIcon />
          <input
            className="search-input"
            id="searchInput"
            placeholder="Buscar cards, clientes, tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="filter-sel" value={plat} onChange={(e) => setPlat(e.target.value as Platform | '')}>
          <option value="">Todas plataformas</option>
          <option value="wpp">WhatsApp</option>
          <option value="insta">Instagram</option>
          <option value="msg">Messenger</option>
        </select>
        <select className="filter-sel" value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
          <option value="">Toda prioridade</option>
          <option value="high">Alta</option>
          <option value="med">Média</option>
          <option value="low">Baixa</option>
        </select>
        <button className="btn btn-ghost cmdk-btn" onClick={openVoice} title="Criar card por voz">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/>
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="btn btn-ghost cmdk-btn" onClick={() => openOcr()} title="Criar card a partir de print/imagem (Ctrl+V)">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <circle cx="8" cy="11" r="2"/>
            <path d="m3 17 5-5 4 4 3-3 6 6"/>
          </svg>
        </button>
        <button className="btn btn-ghost" onClick={() => openMeetingModal()} title="Agendar reunião no Google Calendar">
          <span style={{ fontSize: 13 }}>📅</span>
          Reunião
        </button>
        {canEdit && (
          <>
            <button className="btn btn-ghost" onClick={() => openCol()}>
              <ColumnIcon />
              Coluna
            </button>
            <button className="btn btn-primary" onClick={() => openNewCard()}>
              <PlusIcon />
              Novo card
            </button>
          </>
        )}
        {isViewer && (
          <span style={{ fontSize: 11, color: 'var(--text3)', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            👁 Modo somente leitura
          </span>
        )}
      </div>
    </div>
  );
}

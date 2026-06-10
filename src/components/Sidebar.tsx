import { useState, useRef, useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useWorkspace } from '@/store/workspace';
import { setActiveBoard } from '@/store/data';
import { usePermissions, ROLE_LABELS } from '@/services/permissions';
import { useNotifications } from '@/store/notifications';
import {
  KanbanIcon, ListIcon, DashboardIcon, InboxIcon, TasksIcon, McpIcon, FolderIcon,
  ClientsIcon, AnalyticsIcon, IntegrationsIcon, CalendarIcon, EmailIcon,
  TemplateIcon, GoalIcon, SprintIcon, RoadmapIcon, StarOutlineIcon, SnoozeIcon, ArchiveIcon
} from '@/services/icons';
import { allClients } from '@/services/clients';
import { countMyOpenSubtasks, currentUserNames } from '@/services/mytasks';
import { UserChip } from './UserChip';
import { StreakBadge } from './StreakBadge';
import { OnlineBadge } from './OnlineBadge';
import type { ViewKey } from '@/types';
import { GMAIL_ENABLED } from '@/services/firebase';
import { isWebMode } from '@/services/browserBridge';
import { useMobileNav } from '@/components/MobileNav';
import { usePlan } from '@/services/plan';
import { useUpgrade } from './UpgradeModal';

export function Sidebar() {
  const view = useUI(s => s.view);
  const setView = useUI(s => s.setView);
  const cards = useData(s => s.data.cards);
  const data = useData(s => s.data);
  const activeBoardId = data.activeBoardId;
  const boards = data.boards || [];
  const currentBoard = boards.find(b => b.id === activeBoardId) || boards[0];
  // Per-board filtering for badges
  const boardCards = cards.filter(c => c.boardId === activeBoardId);
  const archivedCount = boardCards.filter(c => c.archived).length;
  const fbStatus = useUI(s => s.fbStatus);
  const fbMsg = useUI(s => s.fbStatusMsg);
  const openMcpInfo = useUI(s => s.openMcpInfo);
  const openBoardModal = useUI(s => s.openBoardModal);
  const openCustomFieldsModal = useUI(s => s.openCustomFieldsModal);
  const unread = useNotifications(s => s.items.filter(n => !n.read).length);
  const clientCount = allClients(data).filter(c => !c.profile?.archived).length;
  const webhookCount = data.integrations?.webhooks?.filter(w => w.enabled).length || 0;
  const customFieldsCount = (data.customFields || []).filter(f => f.boardId === activeBoardId).length;
  const sbUser = useAuth(s => s.user);
  const sbWs = useWorkspace(s => s.currentWorkspace);
  const myOpenTasks = countMyOpenSubtasks(boardCards, currentUserNames(sbUser, sbWs));

  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    try { window.walkersAPI.getAppVersion().then(setAppVersion).catch(() => {}); } catch {}
  }, []);

  useEffect(() => {
    if (!boardMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setBoardMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [boardMenuOpen]);

  const starredCount = boardCards.filter(c => c.starred && !c.archived).length;
  const snoozedCount = boardCards.filter(c => c.snoozedUntil && c.snoozedUntil > Date.now()).length;

  type NavItem = { key: ViewKey; label: string; icon: JSX.Element; badge?: number; alert?: boolean };
  const navGroups: Array<{ title: string; items: NavItem[] }> = [
    { title: 'Trabalho', items: [
      { key: 'kanban', label: 'Kanban', icon: <KanbanIcon /> },
      { key: 'list', label: 'Lista', icon: <ListIcon />, badge: boardCards.length },
      { key: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
      { key: 'mytasks', label: 'Minhas Tarefas', icon: <TasksIcon />, badge: myOpenTasks || undefined }
    ]},
    { title: 'Planejamento', items: [
      { key: 'goals', label: 'Metas', icon: <GoalIcon />, badge: (data.goals?.filter(g => g.status === 'active').length) || undefined },
      { key: 'sprints', label: 'Sprints', icon: <SprintIcon />, badge: (data.sprints?.filter(s => s.boardId === activeBoardId && s.status === 'active').length) || undefined },
      { key: 'roadmap', label: 'Roadmap', icon: <RoadmapIcon /> },
      { key: 'templates', label: 'Templates', icon: <TemplateIcon />, badge: (data.templates?.length) || undefined }
    ]},
    { title: 'Insights', items: [
      { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
      { key: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> }
    ]},
    { title: 'Negócio', items: [
      { key: 'clients', label: 'Clientes', icon: <ClientsIcon />, badge: clientCount || undefined },
      { key: 'integrations', label: 'Integrações', icon: <IntegrationsIcon />, badge: webhookCount || undefined }
    ]},
    { title: 'Pessoal', items: [
      { key: 'inbox', label: 'Caixa de Entrada', icon: <InboxIcon />, badge: unread || undefined, alert: unread > 0 },
      ...(GMAIL_ENABLED ? [{ key: 'emails' as ViewKey, label: 'Emails (Gmail)', icon: <EmailIcon /> }] : []),
      { key: 'starred', label: 'Favoritos', icon: <StarOutlineIcon />, badge: starredCount || undefined },
      { key: 'snoozed', label: 'Adormecidos', icon: <SnoozeIcon />, badge: snoozedCount || undefined },
      { key: 'archive', label: 'Arquivo', icon: <ArchiveIcon />, badge: archivedCount || undefined }
    ]}
  ];

  const handleSwitchBoard = (id: string) => {
    setBoardMenuOpen(false);
    if (id !== activeBoardId) setActiveBoard(id);
  };

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('walkers.sidebar.collapsed') === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('walkers.sidebar.collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>
      <div className="sb-header">
        <div className="sb-logo">W</div>
        <div className="sb-title">Walkers<small>Kanban{appVersion ? ` v${appVersion}` : ''}</small></div>
      </div>
      <WorkspaceSwitcher />
      <div className="board-switcher" ref={menuRef}>
        <button
          className="board-switcher-btn"
          data-tour="boards"
          onClick={() => setBoardMenuOpen(o => !o)}
          title="Trocar board"
        >
          <span className="bsb-emoji">{currentBoard?.emoji || '📋'}</span>
          <span className="bsb-name">{currentBoard?.name || 'Board'}</span>
          <span className="bsb-chev">▾</span>
        </button>
        {boardMenuOpen && (
          <div className="board-menu">
            <div className="bm-section">Boards ({boards.length})</div>
            {boards.map(b => (
              <button
                key={b.id}
                className={`bm-item${b.id === activeBoardId ? ' active' : ''}`}
                onClick={() => handleSwitchBoard(b.id)}
              >
                <span style={{ fontSize: 13 }}>{b.emoji || '📋'}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{b.name}</span>
                {b.id === activeBoardId && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
            <div className="bm-sep" />
            <button className="bm-item" onClick={() => { setBoardMenuOpen(false); openBoardModal(null); }}>
              <span>➕</span><span>Novo Board</span>
            </button>
            <button className="bm-item" onClick={() => { setBoardMenuOpen(false); openBoardModal(activeBoardId); }}>
              <span>✏️</span><span>Editar este board</span>
            </button>
            <button className="bm-item" onClick={() => { setBoardMenuOpen(false); openCustomFieldsModal(); }}>
              <span>🏷️</span>
              <span style={{ flex: 1, textAlign: 'left' }}>Custom Fields</span>
              {customFieldsCount > 0 && <span className="sb-badge">{customFieldsCount}</span>}
            </button>
          </div>
        )}
      </div>
      <div className="sb-sync">
        <div className={`sb-sync-dot ${fbStatus === 'ok' ? 'ok' : fbStatus === 'syncing' ? 'syncing' : fbStatus === 'error' ? 'error' : ''}`} />
        <span>{fbMsg}</span>
      </div>
      <StreakBadge />
      <nav className="sb-nav">
        <Greeting />
        {navGroups.map(g => (
          <div key={g.title}>
            <div className="sb-section">{g.title}</div>
            {g.items.map(it => (
              <button key={it.key} data-tour={it.key} className={`sb-item${view === it.key ? ' active' : ''}`} onClick={() => { setView(it.key); useMobileNav.getState().set(false); }} title={collapsed ? it.label : undefined} aria-current={view === it.key ? 'page' : undefined}>
                {it.icon}
                <span className="sb-item-label">{it.label}</span>
                {it.badge !== undefined && <span className={`sb-badge${it.alert ? ' alert' : ''}`}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-footer">
        <UpgradeCta collapsed={collapsed} />
        <UserChip />
        {/* Itens técnicos do desktop: no modo web "Abrir pasta local" é no-op
            (shim) e MCP exige o app instalado — esconde pra não confundir. */}
        {!isWebMode() && (
          <>
            <button className="sb-foot-btn" onClick={openMcpInfo} title={collapsed ? 'MCP / Claude' : undefined}>
              <McpIcon />
              <span>MCP / Claude</span>
            </button>
            <button className="sb-foot-btn" onClick={() => window.walkersAPI.showDataFolder()} title={collapsed ? 'Abrir pasta local' : undefined}>
              <FolderIcon />
              <span>Abrir pasta local</span>
            </button>
          </>
        )}
        <OnlineBadge collapsed={collapsed} />
      </div>
    </aside>
  );
}

function WorkspaceSwitcher() {
  const workspaces = useWorkspace(s => s.workspaces);
  const current = useWorkspace(s => s.currentWorkspace);
  const loading = useWorkspace(s => s.loading);
  const switchTo = useWorkspace(s => s.switchTo);
  const openModal = useWorkspace(s => s.openModal);
  const openJoinModal = useWorkspace(s => s.openJoinModal);
  const openNewWsModal = useWorkspace(s => s.openNewWsModal);
  const { role, canManage } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  // Renderiza placeholder enquanto carrega ou se falhou — assim o usuário sempre vê o switcher
  if (!current) {
    return (
      <div className="board-switcher" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          className="board-switcher-btn"
          onClick={() => useWorkspace.getState().init()}
          title={loading ? 'Carregando workspace…' : 'Click pra tentar carregar workspaces'}
          style={{ background: 'linear-gradient(90deg, rgba(124,92,252,.10), rgba(236,72,153,.04))', opacity: .7 }}
        >
          <span className="bsb-emoji">{loading ? '⏳' : '🏢'}</span>
          <span className="bsb-name">{loading ? 'Carregando…' : 'Setup workspace'}</span>
          <span className="bsb-chev">↻</span>
        </button>
      </div>
    );
  }

  const handleNew = () => {
    setMenuOpen(false);
    openNewWsModal();
  };

  return (
    <div className="board-switcher" ref={ref} style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        className="board-switcher-btn"
        onClick={() => setMenuOpen(o => !o)}
        title={`Workspace · seu papel: ${role ? ROLE_LABELS[role].label : '—'}`}
        style={{ background: 'linear-gradient(90deg, rgba(124,92,252,.10), rgba(236,72,153,.04))' }}
      >
        <span className="bsb-emoji">{current.emoji || '🏢'}</span>
        <span className="bsb-name">{current.name}</span>
        {role && (
          <span style={{ fontSize: 11, color: ROLE_LABELS[role].color, marginRight: 4 }} title={ROLE_LABELS[role].label}>
            {ROLE_LABELS[role].emoji}
          </span>
        )}
        <span style={{ fontSize: 9, color: 'var(--text3)', marginRight: 4 }}>{current.members.length}👤</span>
        <span className="bsb-chev">▾</span>
      </button>
      {menuOpen && (
        <div className="board-menu">
          <div className="bm-section">Workspaces ({workspaces.length})</div>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              className={`bm-item${ws.id === current.id ? ' active' : ''}`}
              onClick={() => { setMenuOpen(false); if (ws.id !== current.id) switchTo(ws.id); }}
            >
              <span style={{ fontSize: 13 }}>{ws.emoji || '🏢'}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{ws.name}</span>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>{ws.members.length}👤</span>
              {ws.id === current.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </button>
          ))}
          <div className="bm-sep" />
          <button className="bm-item" onClick={handleNew}>
            <span>➕</span><span>Novo workspace</span>
          </button>
          <button className="bm-item" onClick={() => { setMenuOpen(false); openJoinModal(); }}>
            <span>🤝</span><span>Entrar com código</span>
          </button>
          <button className="bm-item" onClick={() => { setMenuOpen(false); openModal(); }}>
            <span>👥</span><span>{canManage ? 'Gerenciar equipe' : 'Ver equipe'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function UpgradeCta({ collapsed }: { collapsed: boolean }) {
  const plan = usePlan(s => s.plan);
  const loaded = usePlan(s => s.loaded);
  if (!loaded || plan !== 'free') return null;
  return (
    <button
      className="sb-upgrade"
      onClick={() => useUpgrade.getState().show('generic')}
      title={collapsed ? 'Fazer upgrade pro Pro' : undefined}
    >
      <span>✨</span>
      <span className="sb-item-label">Fazer upgrade</span>
    </button>
  );
}

function Greeting() {
  const user = useAuth(s => s.user);
  const firstName = (user?.displayName || user?.email || '').split(/[ @]/)[0];
  const h = new Date().getHours();
  let salute = 'Olá';
  let emoji = '👋';
  if (h < 5)      { salute = 'Boa madrugada'; emoji = '🌙'; }
  else if (h < 12){ salute = 'Bom dia';       emoji = '☀️'; }
  else if (h < 18){ salute = 'Boa tarde';     emoji = '🌤️'; }
  else            { salute = 'Boa noite';     emoji = '🌃'; }
  if (!firstName) return null;
  return (
    <div className="greeting">
      <span style={{ marginRight: 6 }}>{emoji}</span>
      {salute}, <strong style={{ color: 'var(--text)' }}>{firstName}</strong>
    </div>
  );
}

import { useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useUI, anyModalOpen, getViewForBoard, rememberViewForBoard } from '@/store/ui';
import { useNotifications } from '@/store/notifications';
import { useTheme } from '@/store/theme';
import { useWorkspace } from '@/store/workspace';
import { Login } from '@/views/Login';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { KanbanView } from '@/views/Kanban';
import { ListView } from '@/views/List';
import { DashboardView } from '@/views/Dashboard';
import { InboxView } from '@/views/Inbox';
import { MyTasksView } from '@/views/MyTasks';
import { ClientsView } from '@/views/Clients';
import { AnalyticsView } from '@/views/Analytics';
import { IntegrationsView } from '@/views/Integrations';
import { CalendarView } from '@/views/Calendar';
import { EmailsView } from '@/views/Emails';
import { EventDetailModal } from '@/components/EventDetailModal';
import { ArchiveView } from '@/views/Archive';
import { TemplatesView } from '@/views/Templates';
import { SnoozedView } from '@/views/Snoozed';
import { StarredView } from '@/views/Starred';
import { GoalsView } from '@/views/Goals';
import { SprintsView } from '@/views/Sprints';
import { RoadmapView } from '@/views/Roadmap';
import { FilterChips } from '@/components/FilterChips';
import { CheatsheetModal } from '@/components/CheatsheetModal';
import { ClientDetailModal } from '@/components/ClientDetailModal';
import { CardDetail } from '@/components/CardDetail';
import { NewCardModal } from '@/components/NewCardModal';
import { ColumnModal } from '@/components/ColumnModal';
import { DeleteCardModal, DeleteColumnModal } from '@/components/ConfirmModals';
import { McpInfoModal } from '@/components/McpInfoModal';
import { CommandPalette } from '@/components/CommandPalette';
import { StreakModal } from '@/components/StreakModal';
import { WeeklyWrapModal } from '@/components/WeeklyWrapModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AchievementToast } from '@/components/AchievementToast';
import { toast } from '@/services/toast';
import { VoiceModal } from '@/components/VoiceModal';
import { OcrModal } from '@/components/OcrModal';
import { SnapshotModal } from '@/components/SnapshotModal';
import { BoardModal } from '@/components/BoardModal';
import { CustomFieldsModal } from '@/components/CustomFieldsModal';
import { ScheduleMeetingModal } from '@/components/ScheduleMeetingModal';
import { NewClientModal } from '@/components/NewClientModal';
import { BulkActionBar } from '@/components/BulkActionBar';
import { QuickPromptModal } from '@/components/QuickPromptModal';
import { WorkspaceModal, JoinWorkspaceModal, NewWorkspaceModal } from '@/components/WorkspaceModal';
import { Toast } from '@/components/Toast';
import { aggregate, effectiveStreak, streakAtRisk, todayStr, weekId } from '@/services/streak';
import { migrateData } from '@/services/storage';
import { runAllReminders } from '@/services/dueReminders';
import { setDoc } from 'firebase/firestore';

export function App() {
  const user = useAuth(s => s.user);
  const authReady = useAuth(s => s.ready);
  const initAuth = useAuth(s => s.init);
  const bootForUser = useData(s => s.bootForUser);
  const teardown = useData(s => s.teardown);
  const flushPending = useData(s => s.flushPending);
  const loadNotifications = useNotifications(s => s.load);
  const view = useUI(s => s.view);
  const closeAllModals = useUI(s => s.closeAllModals);
  const openNewCard = useUI(s => s.openNewCard);
  const setView = useUI(s => s.setView);
  const togglePalette = useUI(s => s.togglePalette);
  const openWrapModal = useUI(s => s.openWrapModal);
  const openOcr = useUI(s => s.openOcr);

  // Theme init (loads stored preference, applies CSS vars, watches OS changes)
  useEffect(() => { useTheme.getState().init(); }, []);

  // Cleanup: remove qualquer API key da AI guardada de versões anteriores
  useEffect(() => {
    try {
      localStorage.removeItem('walkers.anthropicApiKey');
      localStorage.removeItem('walkers.aiKey.v1');
      localStorage.removeItem('walkers.aiEnabled.v1');
    } catch {}
  }, []);

  // UX-11: persist + restore last view per board
  const activeBoardId = useData(s => s.data.activeBoardId);
  useEffect(() => {
    if (!activeBoardId) return;
    const remembered = getViewForBoard(activeBoardId);
    if (remembered && remembered !== view) {
      useUI.setState({ view: remembered });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId]);
  useEffect(() => {
    if (activeBoardId) rememberViewForBoard(activeBoardId, view);
  }, [view, activeBoardId]);

  // Auth bootstrap
  useEffect(() => { initAuth(); }, []);

  // Load notifications + MCP external watcher (runs once)
  useEffect(() => {
    loadNotifications();
    window.walkersAPI.onExternalChange(async () => {
      const state = useData.getState();
      if (!state.kanbanDoc) return;
      const localData = migrateData(await window.walkersAPI.loadData());
      useData.setState({ data: localData, ignoreNextSnapshot: state.fbConnected });
      if (state.fbConnected && state.kanbanDoc) {
        try { await setDoc(state.kanbanDoc, localData); } catch {}
      }
    });
  }, []);

  // Wire up auth → data + workspaces
  useEffect(() => {
    if (!authReady) return;
    if (user) {
      // bootForUser handles workspace migration internally. AFTER it finishes,
      // we sync the workspace store so the switcher actually shows up.
      bootForUser(user.uid).then(() => {
        // Now the workspace exists in Firestore — load it into the store
        useWorkspace.getState().init();
        // Auto-trigger Weekly Wrap on first open of a new ISO week
        const state = useData.getState();
        const streak = state.data.streak;
        const currentWeek = weekId();
        const stats = aggregate(state.data, 7);
        if (
          streak &&
          streak.lastWrapShownWeek !== currentWeek &&
          stats.total > 0 // only show if there was activity to wrap up
        ) {
          // Mark the week as shown so it doesn't re-trigger after dismissal
          state.apply((d) => { if (d.streak) d.streak.lastWrapShownWeek = currentWeek; }, 'other');
          setTimeout(() => openWrapModal(), 800);
        }
      });
    } else {
      teardown();
    }
  }, [user, authReady]);

  // Flush save on close
  useEffect(() => {
    const handler = () => flushPending();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Auto-renew Google OAuth token 5 minutes before it expires.
  // Avoids the "Sessão Google expirou" interruption mid-task.
  useEffect(() => {
    if (!user) return;
    let renewing = false;
    const check = async () => {
      if (renewing) return;
      const { googleAccessToken, googleTokenExpiresAt, silentReauthGoogle } = useAuth.getState();
      if (!googleAccessToken || !googleTokenExpiresAt) return;
      const msUntilExpiry = googleTokenExpiresAt - Date.now();
      // Renew if less than 5 minutes left (but more than 0 — already-expired needs full reauth)
      if (msUntilExpiry > 0 && msUntilExpiry < 5 * 60 * 1000) {
        renewing = true;
        try {
          const fresh = await silentReauthGoogle();
          if (fresh) {
            console.log('[walkers] Google token auto-renewed silently');
            // Subtle toast — only mentions if it succeeded (failures fall back to manual UI)
            toast.success('Sessão Google renovada', { icon: '🔄', durationMs: 2000 });
          }
        } finally {
          renewing = false;
        }
      }
    };
    // Check now (in case page just loaded with stale token) and every 60s
    const initial = setTimeout(check, 3000);
    const interval = setInterval(check, 60_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [user]);

  // OS notification subscriptions: updater + streak-at-risk reminder
  useEffect(() => {
    if (!user) return;
    // Updater toast on download
    window.walkersAPI.onUpdaterStatus((s) => {
      if (s.kind === 'downloaded') {
        window.walkersAPI.showNotification(
          'Atualização pronta',
          `Walkers v${s.version} foi baixado. Abra Configurações pra reiniciar.`
        );
      }
    });
    // Streak-at-risk reminder: once per day, only if streak is at risk and no activity yet today
    const REMINDED_KEY = 'walkers.streak.reminded';
    const check = () => {
      const data = useData.getState().data;
      const streak = data.streak;
      if (!streak || streak.current < 2) return;
      if (!streakAtRisk(streak)) return;
      const today = todayStr();
      const reminded = localStorage.getItem(REMINDED_KEY);
      if (reminded === today) return;
      const days = effectiveStreak(streak);
      window.walkersAPI.showNotification(
        '🔥 Seu streak está em risco',
        `Faltam poucas horas pra perder ${days} dias seguidos. Faça uma ação no Walkers pra manter.`
      );
      localStorage.setItem(REMINDED_KEY, today);
    };
    // Check now and then every hour while app is open
    const initial = setTimeout(check, 10000); // 10s after login
    const interval = setInterval(check, 60 * 60 * 1000); // hourly
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [user]);

  // Lembretes de desktop: vencimentos (hoje/atrasado) + novas atribuições ao usuário.
  // Roda no boot, a cada mudança de dados (debounced, p/ pegar atribuições novas)
  // e de hora em hora (p/ virar o dia e re-checar vencimentos).
  useEffect(() => {
    if (!user) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let prevCards = useData.getState().data.cards;
    // Primeira passada ~12s depois do login (deixa os dados carregarem do Firestore)
    const initial = setTimeout(() => runAllReminders(), 12000);
    const hourly = setInterval(() => runAllReminders(), 60 * 60 * 1000);
    // Reage a mudanças nos cards (atribuir responsável, mudar due, etc.)
    const unsub = useData.subscribe((state) => {
      if (state.data.cards === prevCards) return;
      prevCards = state.data.cards;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => runAllReminders(), 2000);
    });
    return () => {
      clearTimeout(initial);
      clearInterval(hourly);
      if (debounce) clearTimeout(debounce);
      unsub();
    };
  }, [user]);

  // External link delegator
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest('[data-extlink]') as HTMLElement | null;
      if (el) {
        e.preventDefault();
        const url = el.getAttribute('data-extlink');
        if (url) window.walkersAPI.openExternal(url);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // UX-5: Smart paste. Outside inputs, detect:
  //  - image → opens OCR modal pre-loaded with blob
  //  - URL → creates a new card with the URL as note (or attaches if a card is open)
  //  - plain text → creates a new card with that text as the title
  useEffect(() => {
    if (!user) return;
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (useUI.getState().ocrOpen) return;
      if (anyModalOpen()) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      // Image path (existing behavior)
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            openOcr(blob);
            return;
          }
        }
      }
      // Text path — detect URL vs plain text
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text) return;
      const isUrl = /^https?:\/\//.test(text);
      if (isUrl) {
        e.preventDefault();
        // Open new card pre-filled with URL in note
        useUI.getState().openNewCard(undefined, { name: '', note: text });
        toast.info('Cole o nome do cliente e cria o card — link já no campo Observação', { icon: '🔗', durationMs: 3000 });
      } else if (text.length > 3 && text.length < 100) {
        // Short text → treat as potential card name (skip very long pastes — probably accidental)
        e.preventDefault();
        useUI.getState().openNewCard(undefined, { name: text });
        toast.info('Texto colado como nome — confirma ou edita', { icon: '📝', durationMs: 2500 });
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K — Command Palette (works from anywhere, even inside inputs/modals)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        if (!user) return;
        e.preventDefault();
        togglePalette();
        return;
      }
      // Ctrl+, — abrir Configurações
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        if (!user) return;
        e.preventDefault();
        useUI.getState().openSettings();
        return;
      }
      // Ctrl+Shift+N — Novo board
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        if (!user) return;
        e.preventDefault();
        useUI.getState().openBoardModal(null);
        return;
      }
      // UX-4: Ctrl+Z / Cmd+Z = undo last mutation
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const tag = (target?.tagName || '').toLowerCase();
        // Let native undo work inside inputs/textareas (typing)
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        e.preventDefault();
        const ok = useData.getState().undo();
        if (ok) toast.info('Desfeito', { icon: '↶', durationMs: 1500 });
        else toast.error('Nada pra desfazer', { durationMs: 1500 });
        return;
      }
      // UX-13: Cmd+Enter (Ctrl+Enter) saves the primary action in the open modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!anyModalOpen()) return;
        const overlays = document.querySelectorAll('.overlay');
        const last = overlays[overlays.length - 1] as HTMLElement | undefined;
        const btn = last?.querySelector('.btn-primary') as HTMLButtonElement | null;
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
        return;
      }
      if (e.key === 'Escape') {
        closeAllModals();
        return;
      }
      const target = e.target as HTMLElement;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      if (anyModalOpen()) return;
      if (!user) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNewCard(); }
      else if (e.key === '?') { e.preventDefault(); useUI.getState().openCheatsheet(); }
      else if (e.key === '/') {
        e.preventDefault();
        const el = document.getElementById('searchInput') as HTMLInputElement | null;
        el?.focus();
      }
      else if (e.key === '1') setView('kanban');
      else if (e.key === '2') setView('list');
      else if (e.key === '3') setView('dashboard');
      else if (e.key === '4') setView('inbox');
      else if (e.key === '5') setView('mytasks');
      else if (e.key === '6') setView('clients');
      else if (e.key === '7') setView('analytics');
      else if (e.key === '8') setView('integrations');
      else if (e.key === '9') setView('calendar');
      else if (e.key === '0') setView('emails');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [user]);

  if (!authReady) {
    return (
      <div className="splash">
        <div className="splash-logo">W</div>
        <div className="splash-text">Walkers Kanban</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Carregando…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <>
      <div className="app">
        <Sidebar />
        <div className="main">
          <Topbar />
          {(view === 'kanban' || view === 'list') && <FilterChips />}
          <div className="content">
            {view === 'kanban' && <KanbanView />}
            {view === 'list' && <ListView />}
            {view === 'dashboard' && <DashboardView />}
            {view === 'inbox' && <InboxView />}
            {view === 'mytasks' && <MyTasksView />}
            {view === 'clients' && <ClientsView />}
            {view === 'analytics' && <AnalyticsView />}
            {view === 'integrations' && <IntegrationsView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'emails' && <EmailsView />}
            {view === 'archive' && <ArchiveView />}
            {view === 'templates' && <TemplatesView />}
            {view === 'snoozed' && <SnoozedView />}
            {view === 'starred' && <StarredView />}
            {view === 'goals' && <GoalsView />}
            {view === 'sprints' && <SprintsView />}
            {view === 'roadmap' && <RoadmapView />}
          </div>
        </div>
      </div>
      <CardDetail />
      <NewCardModal />
      <ColumnModal />
      <DeleteCardModal />
      <DeleteColumnModal />
      <McpInfoModal />
      <CommandPalette />
      <StreakModal />
      <WeeklyWrapModal />
      <SettingsModal />
      <VoiceModal />
      <OcrModal />
      <SnapshotModal />
      <BoardModal />
      <CustomFieldsModal />
      <ScheduleMeetingModal />
      <NewClientModal />
      <BulkActionBar />
      <QuickPromptModal />
      <WorkspaceModal />
      <JoinWorkspaceModal />
      <NewWorkspaceModal />
      <ClientDetailModal />
      <EventDetailModal />
      <AchievementToast />
      <Toast />
      <CheatsheetModal />
    </>
  );
}

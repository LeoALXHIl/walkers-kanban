import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUI } from '@/store/ui';
import { useData, createCardFromTemplate, setActiveBoard } from '@/store/data';
import { useAuth } from '@/store/auth';
import { useNotifications } from '@/store/notifications';
import {
  SearchIcon, PlusIcon, KanbanIcon, ListIcon, DashboardIcon, InboxIcon,
  TasksIcon, ColumnIcon, McpIcon, FolderIcon, LogoutIcon, TrashIcon,
  CalIcon, SubIcon, SettingsIcon, ClientsIcon, AnalyticsIcon, IntegrationsIcon, CalendarIcon, EmailIcon
} from '@/services/icons';
import { pickHashColor } from '@/services/colors';
import { getRecentCards } from '@/services/recent';
import { GMAIL_ENABLED } from '@/services/firebase';
import { quickPrompt } from '@/services/quickPrompt';

type CmdCategory = 'Ações' | 'Cards' | 'Clientes' | 'Views' | 'Filtros' | 'Conta' | 'Boards' | 'Recentes';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: CmdCategory;
  icon: ReactNode;
  shortcut?: string;
  keywords?: string;
  run: () => void;
}

// Simple fuzzy scoring — higher is better. 0 = no match.
function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 1;

  // Exact substring: best, with bonus for early position and word boundary
  const idx = h.indexOf(n);
  if (idx !== -1) {
    const wordBoundary = idx === 0 || /\s|·|-|_|\//.test(h[idx - 1]);
    return 1000 + (wordBoundary ? 200 : 0) - idx;
  }

  // Fuzzy: each char in needle appears in order in haystack
  let lastIdx = -1;
  let matched = 0;
  let consec = 0, maxConsec = 0;
  for (const c of n) {
    const i = h.indexOf(c, lastIdx + 1);
    if (i === -1) return 0;
    if (i === lastIdx + 1) consec++;
    else { maxConsec = Math.max(maxConsec, consec); consec = 1; }
    lastIdx = i;
    matched++;
  }
  maxConsec = Math.max(maxConsec, consec);
  return matched * 10 + maxConsec * 5;
}

export function CommandPalette() {
  const open = useUI(s => s.paletteOpen);
  const close = useUI(s => s.closePalette);
  const setView = useUI(s => s.setView);
  const openNewCard = useUI(s => s.openNewCard);
  const openCol = useUI(s => s.openCol);
  const openMcpInfo = useUI(s => s.openMcpInfo);
  const openStreakModal = useUI(s => s.openStreakModal);
  const openWrapModal = useUI(s => s.openWrapModal);
  const openSettings = useUI(s => s.openSettings);
  const openVoice = useUI(s => s.openVoice);
  const openOcr = useUI(s => s.openOcr);
  const openSnapshot = useUI(s => s.openSnapshot);
  const openClientDetail = useUI(s => s.openClientDetail);
  const openDetail = useUI(s => s.openDetail);
  const openBoardModal = useUI(s => s.openBoardModal);
  const openCustomFieldsModal = useUI(s => s.openCustomFieldsModal);
  const setQ = useUI(s => s.setQ);
  const setPlat = useUI(s => s.setPlat);
  const setPrio = useUI(s => s.setPrio);
  const allCards = useData(s => s.data.cards);
  const allCols = useData(s => s.data.cols);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const boards = useData(s => s.data.boards || []);
  const cards = allCards.filter(c => !c.boardId || c.boardId === activeBoardId);
  const cols = allCols.filter(c => !c.boardId || c.boardId === activeBoardId);
  const templates = useData(s => s.data.templates || []);
  const logout = useAuth(s => s.logout);
  const teardown = useData(s => s.teardown);
  const clearInbox = useNotifications(s => s.clear);

  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build commands once per open or when underlying data changes
  const commands: Command[] = useMemo(() => {
    if (!open) return [];

    const list: Command[] = [];

    // ─── Recent cards (only show before any query, max 6) ───
    const recentIds = getRecentCards().slice(0, 6);
    recentIds.forEach(id => {
      const c = allCards.find(x => x.id === id);
      if (!c) return;
      list.push({
        id: `recent:${c.id}`,
        label: c.name,
        description: 'Recente',
        category: 'Recentes',
        icon: (
          <div style={{
            width: 16, height: 16, borderRadius: 4,
            background: pickHashColor(c.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 8, fontWeight: 700
          }}>{c.name.slice(0, 2).toUpperCase()}</div>
        ),
        keywords: c.note + ' ' + c.desc + ' recente',
        run: () => openDetail(c.id)
      });
    });

    // Views
    list.push({ id: 'view:kanban', label: 'Kanban', category: 'Views', icon: <KanbanIcon />, shortcut: '1', run: () => setView('kanban') });
    list.push({ id: 'view:list', label: 'Lista', category: 'Views', icon: <ListIcon />, shortcut: '2', run: () => setView('list') });
    list.push({ id: 'view:dash', label: 'Dashboard', category: 'Views', icon: <DashboardIcon />, shortcut: '3', run: () => setView('dashboard') });
    list.push({ id: 'view:inbox', label: 'Caixa de Entrada', category: 'Views', icon: <InboxIcon />, shortcut: '4', run: () => setView('inbox') });
    list.push({ id: 'view:tasks', label: 'Minhas Tarefas', category: 'Views', icon: <TasksIcon />, shortcut: '5', run: () => setView('mytasks') });
    list.push({ id: 'view:clients', label: 'Clientes (CRM)', description: 'Lista de clientes com perfis', category: 'Views', icon: <ClientsIcon />, shortcut: '6', run: () => setView('clients') });
    list.push({ id: 'view:analytics', label: 'Analytics', description: 'Funil, heatmap, top clientes', category: 'Views', icon: <AnalyticsIcon />, shortcut: '7', run: () => setView('analytics') });
    list.push({ id: 'view:integrations', label: 'Integrações', description: 'Webhooks e conectores', category: 'Views', icon: <IntegrationsIcon />, shortcut: '8', run: () => setView('integrations') });
    list.push({ id: 'view:calendar', label: 'Calendar', description: 'Vencimentos + Google Calendar', category: 'Views', icon: <CalendarIcon />, shortcut: '9', keywords: 'agenda mes reuniao meeting', run: () => setView('calendar') });
    if (GMAIL_ENABLED) list.push({ id: 'view:emails', label: 'Emails (Gmail)', description: 'Sua caixa Gmail aqui', category: 'Views', icon: <EmailIcon />, shortcut: '0', keywords: 'email gmail mensagens caixa', run: () => setView('emails') });
    list.push({ id: 'view:templates', label: 'Templates', description: 'Criar cards repetitivos com 1 clique', category: 'Views', icon: <span>📋</span> as any, keywords: 'templates modelos repetitivo recorrente padrao', run: () => setView('templates') });

    // ─── Boards ─────────────────────────────────────────
    boards.forEach(b => {
      if (b.id === activeBoardId) return;
      list.push({
        id: `board:${b.id}`,
        label: `Trocar pra: ${b.name}`,
        description: 'Mudar de board',
        category: 'Boards',
        icon: <span>{b.emoji || '📋'}</span> as any,
        keywords: `board workspace trocar ${b.name}`,
        run: () => setActiveBoard(b.id)
      });
    });
    list.push({ id: 'board:new', label: 'Novo Board', description: 'Crie um workspace separado', category: 'Boards', icon: <span>➕</span> as any, keywords: 'board novo criar workspace', run: () => openBoardModal(null) });
    list.push({ id: 'board:edit', label: 'Editar board atual', description: 'Renomear, mudar emoji/cor', category: 'Boards', icon: <span>✏️</span> as any, keywords: 'board editar renomear', run: () => openBoardModal(activeBoardId) });
    list.push({ id: 'board:cf', label: 'Custom Fields', description: 'Gerenciar campos personalizados do board', category: 'Boards', icon: <span>🏷️</span> as any, keywords: 'custom fields campos personalizado url webhook api key', run: () => openCustomFieldsModal() });

    // Actions
    list.push({ id: 'act:streak', label: 'Ver streak, conquistas e atividade', description: 'Heatmap + badges desbloqueadas', category: 'Ações', icon: <CalIcon />, keywords: 'fogo sequencia atividade heatmap conquistas badges achievements troféu', run: () => openStreakModal() });
    list.push({ id: 'act:wrap', label: 'Weekly Wrap', description: 'Resumo dos últimos 7 dias', category: 'Ações', icon: <SubIcon />, keywords: 'resumo semana semanal recap', run: () => openWrapModal() });
    list.push({ id: 'act:settings', label: 'Configurações', description: 'Tray, auto-launch, atualizações', category: 'Ações', icon: <SettingsIcon />, keywords: 'preferencias settings options', run: () => openSettings() });
    list.push({ id: 'act:new-card', label: 'Novo card', description: 'Criar um novo card', category: 'Ações', icon: <PlusIcon />, shortcut: 'N', run: () => openNewCard() });
    list.push({ id: 'act:voice', label: 'Criar card por voz', description: 'Dite o card em pt-BR', category: 'Ações', icon: <PlusIcon />, keywords: 'voz fala microfone ditar speech', run: () => openVoice() });
    list.push({ id: 'act:ocr', label: 'Criar card de um print', description: 'Cole imagem do WhatsApp/Insta e extraia o texto', category: 'Ações', icon: <PlusIcon />, keywords: 'imagem foto screenshot print ocr texto', run: () => openOcr() });
    list.push({ id: 'act:share-streak', label: 'Compartilhar streak (PNG)', description: 'Gera imagem 1080×1080 do seu streak', category: 'Ações', icon: <CalIcon />, keywords: 'snapshot compartilhar fogo png imagem instagram linkedin', run: () => openSnapshot('streak') });
    list.push({ id: 'act:share-weekly', label: 'Compartilhar semana (PNG)', description: 'Gera imagem do Weekly Wrap', category: 'Ações', icon: <SubIcon />, keywords: 'snapshot compartilhar semana png imagem wrap', run: () => openSnapshot('weekly') });
    list.push({
      id: 'act:random-pick',
      label: '🎲 O que faço agora?',
      description: 'Sugere um card prioritário aleatório do board atual',
      category: 'Ações',
      icon: <span>🎲</span> as any,
      keywords: 'random aleatorio sugerir picker pick focus foco',
      run: () => {
        const candidates = cards.filter(c => !c.archived && !(c.snoozedUntil && c.snoozedUntil > Date.now()));
        if (candidates.length === 0) return;
        // Weighted: high prio 3x, med 2x, low 1x; with due date bonus
        const now = Date.now();
        const weighted: typeof cards = [];
        candidates.forEach(c => {
          let w = c.prio === 'high' ? 3 : c.prio === 'med' ? 2 : 1;
          if (c.due) {
            const due = new Date(c.due + 'T00:00:00').getTime();
            if (due < now) w += 3; // overdue
            else if (due - now < 86400000) w += 2; // due today
          }
          if (c.starred) w += 2;
          for (let i = 0; i < w; i++) weighted.push(c);
        });
        const pick = weighted[Math.floor(Math.random() * weighted.length)];
        if (pick) openDetail(pick.id);
      }
    });
    list.push({ id: 'act:new-col', label: 'Nova coluna', description: 'Adicionar coluna ao board', category: 'Ações', icon: <ColumnIcon />, run: () => openCol() });
    list.push({ id: 'act:mcp', label: 'Conectar Claude (MCP)', description: 'Configuração para Claude Desktop', category: 'Ações', icon: <McpIcon />, run: () => openMcpInfo() });
    list.push({ id: 'act:folder', label: 'Abrir pasta local', description: '~/.walkers-kanban', category: 'Ações', icon: <FolderIcon />, run: () => window.walkersAPI.showDataFolder() });
    list.push({ id: 'act:clear-inbox', label: 'Limpar notificações', description: 'Apaga toda a caixa de entrada', category: 'Ações', icon: <TrashIcon />, run: () => { if (confirm('Limpar todas as notificações?')) clearInbox(); } });

    // Filters
    list.push({
      id: 'filt:clear', label: 'Limpar todos os filtros', category: 'Filtros',
      icon: <SearchIcon />, keywords: 'reset busca plataforma prioridade',
      run: () => { setQ(''); setPlat(''); setPrio(''); }
    });
    list.push({
      id: 'filt:overdue', label: 'Mostrar só atrasados', category: 'Filtros',
      icon: <CalIcon />, keywords: 'vencidos atraso urgente',
      run: () => { setView('mytasks'); }
    });
    list.push({
      id: 'filt:high', label: 'Filtrar: prioridade alta', category: 'Filtros',
      icon: <CalIcon />, keywords: 'urgente importante',
      run: () => { setPrio('high'); setView('kanban'); }
    });
    list.push({
      id: 'filt:wpp', label: 'Filtrar: WhatsApp', category: 'Filtros',
      icon: <SearchIcon />, keywords: 'wpp whats',
      run: () => { setPlat('wpp'); setView('kanban'); }
    });
    list.push({
      id: 'filt:insta', label: 'Filtrar: Instagram', category: 'Filtros',
      icon: <SearchIcon />, keywords: 'ig',
      run: () => { setPlat('insta'); setView('kanban'); }
    });

    // Cards — dynamic from current data
    const sortedCards = [...cards].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    for (const c of sortedCards) {
      const col = cols.find(x => x.id === c.cid);
      list.push({
        id: 'card:' + c.id,
        label: c.name,
        description: col ? `Abrir card · ${col.name}` : 'Abrir card',
        category: 'Cards',
        icon: (
          <div style={{
            width: 16, height: 16, borderRadius: 4,
            background: pickHashColor(c.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 8, fontWeight: 700
          }}>
            {c.name.slice(0, 2).toUpperCase()}
          </div>
        ),
        keywords: [c.note, c.desc, c.assignee || '', ...(c.tagIds || [])].join(' '),
        run: () => openDetail(c.id)
      });
    }

    // Templates (one command per template — "Criar de template: X")
    for (const tpl of templates) {
      list.push({
        id: 'tpl:' + tpl.id,
        label: `Criar card de template: ${tpl.name}`,
        description: tpl.description || `${tpl.defaults.subtasks?.length || 0} subtarefas pré-preenchidas`,
        category: 'Ações',
        icon: <span>{tpl.emoji || '📋'}</span> as any,
        keywords: 'template ' + (tpl.description || ''),
        run: async () => {
          const clientName = await quickPrompt({
            title: `Template: ${tpl.name}`,
            message: 'Nome do cliente pra usar nesse card (substitui {{cliente}})',
            placeholder: 'Ex: Loja da Maria',
            okLabel: 'Criar card'
          });
          if (clientName === null) return;
          const card = createCardFromTemplate(tpl.id, clientName.trim() || 'Novo card');
          if (card) setTimeout(() => openDetail(card.id), 150);
        }
      });
    }

    // Clients (open client detail directly)
    const clientNames = new Map<string, string>();
    for (const c of cards) {
      const key = c.name.trim().toLowerCase();
      if (!clientNames.has(key)) clientNames.set(key, c.name);
    }
    for (const [key, displayName] of clientNames) {
      list.push({
        id: 'client:' + key,
        label: displayName,
        description: 'Abrir perfil do cliente',
        category: 'Clientes' as CmdCategory,
        icon: <ClientsIcon />,
        keywords: 'cliente crm perfil',
        run: () => openClientDetail(key)
      });
    }

    // Account
    list.push({
      id: 'acc:logout', label: 'Sair da conta', category: 'Conta',
      icon: <LogoutIcon />,
      run: async () => {
        if (!confirm('Sair da conta?')) return;
        await teardown();
        await logout();
      }
    });

    return list;
  }, [open, cards, cols]);

  // Filter & sort by score
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const scored = commands
      .map(c => {
        const labelScore = fuzzyScore(c.label, query);
        const descScore = c.description ? fuzzyScore(c.description, query) * 0.4 : 0;
        const kwScore = c.keywords ? fuzzyScore(c.keywords, query) * 0.5 : 0;
        const score = Math.max(labelScore, descScore, kwScore);
        return { cmd: c, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    return scored.map(x => x.cmd);
  }, [commands, query]);

  // Reset selection when filter changes
  useEffect(() => { setSel(0); }, [query, open]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  const execute = (cmd: Command) => {
    close();
    // small delay so close animation begins before potential next modal opens
    setTimeout(() => cmd.run(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[sel];
      if (cmd) execute(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Group by category for empty query, flat for searching
  const grouped: Array<{ cat: CmdCategory; items: Command[] }> = [];
  if (!query.trim()) {
    const order: CmdCategory[] = ['Views', 'Ações', 'Filtros', 'Clientes', 'Cards', 'Conta'];
    for (const cat of order) {
      const items = filtered.filter(c => c.category === cat);
      if (items.length) grouped.push({ cat, items });
    }
  } else {
    grouped.push({ cat: 'Resultados' as CmdCategory, items: filtered });
  }

  let runningIdx = 0;

  return (
    <div className="palette-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="palette" onKeyDown={onKeyDown}>
        <div className="palette-input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="O que você quer fazer? (cliente, ação, view…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="palette-hint">Esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">Nenhum resultado pra <strong>"{query}"</strong></div>
          ) : (
            grouped.map(group => (
              <div key={group.cat}>
                <div className="palette-section-title">{group.cat}</div>
                {group.items.map((cmd) => {
                  const idx = runningIdx++;
                  return (
                    <div
                      key={cmd.id}
                      data-idx={idx}
                      className={`palette-item${idx === sel ? ' active' : ''}`}
                      onMouseEnter={() => setSel(idx)}
                      onClick={() => execute(cmd)}
                    >
                      <div className="palette-item-icon">{cmd.icon}</div>
                      <div className="palette-item-body">
                        <div className="palette-item-label">{cmd.label}</div>
                        {cmd.description && <div className="palette-item-desc">{cmd.description}</div>}
                      </div>
                      {cmd.shortcut && <span className="palette-item-shortcut">{cmd.shortcut}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-footer">
          <span><kbd>↑↓</kbd>navegar</span>
          <span><kbd>↵</kbd>executar</span>
          <span><kbd>Esc</kbd>fechar</span>
          <span style={{ marginLeft: 'auto' }}>{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}

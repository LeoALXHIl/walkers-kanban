import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';
import { listGmailMessages, getGmailMessageBody, prettySender, GoogleAuthError, type GmailMessageBrief } from '@/services/google';
import { parseTranscript } from '@/services/parser';
import { toast } from '@/services/toast';
import { pickHashColor } from '@/services/colors';
import { EmailIcon, ExternalIcon, PlusIcon } from '@/services/icons';

interface QuickFilter { label: string; query: string; emoji?: string }

const FILTERS: QuickFilter[] = [
  { label: 'Inbox',         query: 'in:inbox',                    emoji: '📥' },
  { label: 'Não lidos',     query: 'in:inbox is:unread',          emoji: '⚪' },
  { label: 'Estrelados',    query: 'is:starred',                  emoji: '⭐' },
  { label: 'Últimos 7d',    query: 'newer_than:7d in:inbox',      emoji: '📅' },
  { label: 'Com anexo',     query: 'has:attachment in:inbox',     emoji: '📎' },
  { label: 'Importantes',   query: 'is:important in:inbox',       emoji: '🔥' }
];

export function EmailsView() {
  const googleToken = useAuth(s => s.googleAccessToken);
  const reauthGoogle = useAuth(s => s.reauthGoogle);
  const openNewCard = useUI(s => s.openNewCard);

  const [query, setQuery] = useState('in:inbox');
  const [customQuery, setCustomQuery] = useState('');
  const [messages, setMessages] = useState<GmailMessageBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [body, setBody] = useState<{ subject: string; from: string; body: string; date: string } | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [search, setSearch] = useState('');

  const loadList = async (q: string) => {
    if (!googleToken) return;
    setLoading(true);
    setError('');
    setSelectedId(null);
    setBody(null);
    try {
      const msgs = await listGmailMessages(q, 20);
      setMessages(msgs);
    } catch (e: any) {
      setError(e.message || 'Erro');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Reload when query changes
  useEffect(() => {
    if (googleToken) loadList(query);
  }, [query, googleToken]);

  // Auto-load body when selecting email
  useEffect(() => {
    if (!selectedId) { setBody(null); return; }
    setLoadingBody(true);
    setBody(null);
    getGmailMessageBody(selectedId)
      .then(b => setBody(b))
      .catch((e: any) => { setError(e.message || 'Erro ao carregar email'); })
      .finally(() => setLoadingBody(false));
  }, [selectedId]);

  // Client-side search filter on currently-loaded messages
  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const q = search.toLowerCase();
    return messages.filter(m =>
      (m.subject || '').toLowerCase().includes(q) ||
      (m.from || '').toLowerCase().includes(q) ||
      (m.snippet || '').toLowerCase().includes(q)
    );
  }, [messages, search]);

  const reconnect = async () => {
    const tk = await reauthGoogle();
    if (tk) toast.success('Reconectado com Google ✓');
    else toast.error('Falha ao reconectar');
  };

  const createCardFromEmail = () => {
    if (!body) return;
    const sender = prettySender(body.from);
    const parsed = parseTranscript(`${body.subject}\n${body.body.slice(0, 500)}`);
    openNewCard(undefined, {
      name: body.subject || sender,
      note: `📧 ${sender}\n${body.body.slice(0, 400)}${body.body.length > 400 ? '…' : ''}`,
      plat: parsed.plat,
      prio: parsed.prio,
      due: parsed.due
    });
  };

  const fmtDate = (raw: string | undefined) => {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      const today = new Date(); today.setHours(0,0,0,0);
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch { return raw; }
  };

  if (!googleToken) {
    return (
      <div className="emails-view">
        <div className="board-empty">
          <div className="board-empty-emoji">📧</div>
          <h2 className="board-empty-title">Conecte sua conta Google</h2>
          <p className="board-empty-sub">Pra ver e gerenciar emails do Gmail aqui, conecte o Google em Integrações.</p>
          <div className="board-empty-actions">
            <button className="btn btn-primary" onClick={reconnect}>🔗 Conectar Google</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="emails-view">
      <div className="emails-toolbar">
        <div className="emails-filters">
          {FILTERS.map(f => (
            <button
              key={f.query}
              className={`email-filter-chip${query === f.query ? ' active' : ''}`}
              onClick={() => setQuery(f.query)}
            >
              {f.emoji && <span>{f.emoji}</span>} {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <input
            className="finput"
            placeholder="Query Gmail customizada..."
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && customQuery.trim()) setQuery(customQuery.trim()); }}
            style={{ width: 280, padding: '6px 10px', fontSize: 11 }}
          />
        </div>
      </div>

      {error && <div className="cal-error" style={{ marginBottom: 10 }}>{error}</div>}

      <div className="emails-pane">
        {/* Left: list */}
        <div className="emails-list-pane">
          <div className="emails-list-head">
            <input
              className="finput"
              placeholder="Filtrar nesta lista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 11 }}
            />
            <span className="emails-count">{filtered.length} {filtered.length === 1 ? 'email' : 'emails'}</span>
          </div>
          {loading ? (
            <div className="emails-loading">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="emails-empty">Nenhum email com este filtro</div>
          ) : (
            <div className="emails-list">
              {filtered.map(m => {
                const sender = prettySender(m.from);
                const isUnread = (m.labelIds || []).includes('UNREAD');
                return (
                  <div
                    key={m.id}
                    className={`email-row${selectedId === m.id ? ' selected' : ''}${isUnread ? ' unread' : ''}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <div className="email-avatar" style={{ background: pickHashColor(sender) }}>
                      {sender.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="email-row-body">
                      <div className="email-row-top">
                        <span className="email-row-from">{sender}</span>
                        <span className="email-row-date">{fmtDate(m.date)}</span>
                      </div>
                      <div className="email-row-subject">{m.subject || '(sem assunto)'}</div>
                      <div className="email-row-snippet">{m.snippet}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: body preview */}
        <div className="emails-body-pane">
          {!selectedId ? (
            <div className="emails-body-placeholder">
              <EmailIcon />
              <h3>Selecione um email pra ver o conteúdo</h3>
              <p>Use os filtros acima ou busca customizada do Gmail.</p>
            </div>
          ) : loadingBody ? (
            <div className="emails-loading">Carregando email…</div>
          ) : body ? (
            <>
              <div className="email-body-head">
                <div className="email-body-subject">{body.subject || '(sem assunto)'}</div>
                <div className="email-body-meta">
                  <div className="email-avatar" style={{ background: pickHashColor(prettySender(body.from)), width: 32, height: 32, fontSize: 12 }}>
                    {prettySender(body.from).slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="email-body-from">{prettySender(body.from)}</div>
                    <div className="email-body-date">{body.date}</div>
                  </div>
                </div>
                <div className="email-body-actions">
                  <button className="btn btn-primary" onClick={createCardFromEmail}>
                    <PlusIcon /> Criar card deste email
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => window.walkersAPI.openExternal(`https://mail.google.com/mail/u/0/#inbox/${selectedId}`)}
                    title="Abrir no Gmail"
                  >
                    <ExternalIcon /> Abrir no Gmail
                  </button>
                </div>
              </div>
              <div className="email-body-content">
                {body.body || <em style={{ color: 'var(--text3)' }}>(Email sem conteúdo de texto)</em>}
              </div>
            </>
          ) : (
            <div className="emails-body-placeholder">
              <p style={{ color: 'var(--red)' }}>Erro ao carregar este email.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

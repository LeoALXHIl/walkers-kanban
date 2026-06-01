import { useEffect, useMemo, useState } from 'react';
import { useData, addWebhook, updateWebhook, deleteWebhook } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { TrashIcon } from '@/services/icons';
import { toast } from '@/services/toast';
import { listGmailMessages, getGmailMessageBody, prettySender, GoogleAuthError, type GmailMessageBrief } from '@/services/google';
import { GMAIL_ENABLED } from '@/services/firebase';
import { parseTranscript } from '@/services/parser';
import { downloadIcs } from '@/services/ical';
import { exportCards, exportSubtasks, exportClients } from '@/services/exportData';

const EVENT_LABELS = {
  'card.created': 'Card criado',
  'card.moved': 'Card movido',
  'card.completed': 'Card concluído',
  'card.deleted': 'Card deletado'
} as const;

type Evt = keyof typeof EVENT_LABELS;

export function IntegrationsView() {
  const integrations = useData(s => s.data.integrations);
  const webhooks = integrations?.webhooks || [];
  const data = useData(s => s.data);
  const openNewCard = useUI(s => s.openNewCard);
  const googleToken = useAuth(s => s.googleAccessToken);
  const tokenExpiresAt = useAuth(s => s.googleTokenExpiresAt);
  const reauthGoogle = useAuth(s => s.reauthGoogle);

  // Webhook form state
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<Evt[]>(['card.completed']);

  // Gmail panel state
  const [gmailQuery, setGmailQuery] = useState('in:inbox');
  const [gmailMessages, setGmailMessages] = useState<GmailMessageBrief[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState('');

  const submitWebhook = () => {
    if (!newName.trim() || !newUrl.trim()) { toast.error('Nome e URL são obrigatórios'); return; }
    if (!/^https?:\/\//i.test(newUrl)) { toast.error('URL deve começar com http:// ou https://'); return; }
    addWebhook({ name: newName.trim(), url: newUrl.trim(), events: newEvents, enabled: true });
    toast.success(`Webhook "${newName}" criado`, { icon: '🔗' });
    setNewName(''); setNewUrl(''); setNewEvents(['card.completed']);
    setShowWebhookForm(false);
  };

  const toggleEvent = (e: Evt) => {
    setNewEvents(cur => cur.includes(e) ? cur.filter(x => x !== e) : [...cur, e]);
  };

  const reconnect = async () => {
    const tk = await reauthGoogle();
    if (tk) toast.success('Reconectado com Google ✓');
    else toast.error('Falha ao reconectar');
  };

  const loadGmail = async () => {
    if (!googleToken) { toast.error('Conecte o Google primeiro'); return; }
    setGmailLoading(true);
    setGmailError('');
    try {
      const msgs = await listGmailMessages(gmailQuery, 15);
      setGmailMessages(msgs);
      if (msgs.length === 0) toast.info(`Nenhum email encontrado pra "${gmailQuery}"`);
    } catch (e: any) {
      setGmailError(e.message || 'Erro');
      if (e instanceof GoogleAuthError) toast.warn('Reconecte o Google');
    } finally {
      setGmailLoading(false);
    }
  };

  const createFromEmail = async (msg: GmailMessageBrief) => {
    try {
      toast.info('Carregando email…');
      const full = await getGmailMessageBody(msg.id);
      const sender = prettySender(full.from);
      const text = `${full.subject}\n\nDe: ${sender}\n\n${full.body.slice(0, 500)}`;
      const parsed = parseTranscript(text);
      openNewCard(undefined, {
        name: full.subject || sender,
        note: `📧 ${sender}\n${full.body.slice(0, 300)}${full.body.length > 300 ? '…' : ''}`,
        plat: parsed.plat,
        prio: parsed.prio,
        due: parsed.due
      });
    } catch (e: any) {
      toast.error(e.message || 'Falha ao carregar email');
    }
  };

  const exportIcs = () => {
    const count = data.cards.filter(c => c.due).length;
    if (count === 0) { toast.warn('Nenhum card com data de vencimento pra exportar'); return; }
    downloadIcs(data);
    toast.success(`✓ ${count} card(s) exportados em walkers-kanban.ics`);
  };

  // Live countdown — re-renders every 30s
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tokenStatus = useMemo(() => {
    if (!googleToken) return '🔴 Não conectado';
    if (!tokenExpiresAt) return '🟡 Sem expiração definida';
    const msLeft = tokenExpiresAt - now;
    if (msLeft <= 0) return '🟡 Expirado — auto-renovação tentará em segundos…';
    const minLeft = Math.round(msLeft / 60000);
    const hh = Math.floor(minLeft / 60);
    const mm = minLeft % 60;
    const left = hh > 0 ? `${hh}h${String(mm).padStart(2, '0')}` : `${mm} min`;
    const expiresAtStr = new Date(tokenExpiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (minLeft <= 5) return `🟡 Renovação automática em andamento… (expira em ${left})`;
    return `🟢 Conectado · faltam ${left} (expira ${expiresAtStr}) · renova sozinho 5min antes`;
  }, [googleToken, tokenExpiresAt, now]);

  return (
    <div className="integrations-view">
      <div className="int-intro">
        <h2>Integrações</h2>
        <p>Conecte o Walkers com suas ferramentas. Faça login com Google pra ativar o Calendar.</p>
      </div>

      {/* ─── Exportar dados (Power BI / Excel) — grátis, sem API ─── */}
      <div className="int-section">
        <div className="int-section-head">
          <div>
            <div className="int-section-title">📊 Exportar pra Power BI / Excel</div>
            <div className="int-section-sub">Baixa uma planilha CSV (1 linha por item). Importe no Power BI (Obter Dados → Texto/CSV) ou abra no Excel. Grátis, sem configuração.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => { const n = exportCards(); toast.success(`${n} cards exportados`, { icon: '📊' }); }}>
            ⬇ Cards
          </button>
          <button className="btn btn-ghost" onClick={() => { const n = exportSubtasks(); toast.success(`${n} subtarefas exportadas`, { icon: '✓' }); }}>
            ⬇ Subtarefas
          </button>
          <button className="btn btn-ghost" onClick={() => { const n = exportClients(); toast.success(`${n} clientes exportados`, { icon: '👤' }); }}>
            ⬇ Clientes
          </button>
        </div>
        <div className="int-hint" style={{ marginTop: 10 }}>
          💡 Dica: salve o CSV numa pasta do OneDrive e configure o Power BI pra reler o arquivo — aí atualiza quase sozinho, sem pagar nada.
        </div>
      </div>

      {/* ─── Google connection master switch ─── */}
      <div className="int-section">
        <div className="int-section-head">
          <div>
            <div className="int-section-title">🔐 Conexão Google</div>
            <div className="int-section-sub">{tokenStatus}</div>
          </div>
          <button className="btn btn-primary" onClick={reconnect}>
            {googleToken ? 'Reconectar' : 'Conectar com Google'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
          Conecte sua conta Google para ver o Calendar dentro do Walkers. A sessão renova sozinha enquanto o app está aberto; se expirar, reconecte com um clique.
        </div>

      </div>

      {/* ─── Google Calendar ─── */}
      <div className="int-section">
        <div className="int-section-head">
          <div>
            <div className="int-section-title">📅 Google Calendar</div>
            <div className="int-section-sub">
              {googleToken ? 'Seus eventos aparecem na tela Calendar (tecla 9). Clique num evento pra entrar na reunião.' : 'Conecte o Google acima pra ver suas reuniões.'}
            </div>
          </div>
          {googleToken && (
            <button className="btn btn-ghost" onClick={() => useUI.getState().setView('calendar')}>
              Abrir Calendar
            </button>
          )}
        </div>
      </div>

      {/* ─── Gmail real (oculto enquanto o scope não é verificado — ver GMAIL_ENABLED) ─── */}
      {GMAIL_ENABLED && (
      <div className="int-section">
        <div className="int-section-head">
          <div>
            <div className="int-section-title">📥 Gmail → Card</div>
            <div className="int-section-sub">Liste emails do Gmail e crie cards a partir deles.</div>
          </div>
        </div>
        {googleToken ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                className="finput"
                placeholder='Query Gmail (ex: "is:unread label:walkers" ou "from:cliente@x.com")'
                value={gmailQuery}
                onChange={(e) => setGmailQuery(e.target.value)}
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') loadGmail(); }}
              />
              <button className="btn btn-primary" onClick={loadGmail} disabled={gmailLoading}>
                {gmailLoading ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {gmailError && <div className="cal-error" style={{ marginTop: 10 }}>{gmailError}</div>}
            {gmailMessages.length > 0 && (
              <div className="gmail-list">
                {gmailMessages.map(m => (
                  <div key={m.id} className="gmail-row">
                    <div className="gmail-row-body">
                      <div className="gmail-row-from">{prettySender(m.from)}</div>
                      <div className="gmail-row-subject">{m.subject || '(sem assunto)'}</div>
                      <div className="gmail-row-snippet">{m.snippet}</div>
                    </div>
                    <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => createFromEmail(m)}>
                      + Card
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="int-hint">
              💡 Use queries Gmail completas: <code>is:unread</code>, <code>label:walkers</code>, <code>from:cliente@x.com</code>, <code>has:attachment</code>, <code>newer_than:7d</code>
            </div>
          </>
        ) : (
          <div className="int-empty">Conecte o Google primeiro pra usar Gmail → Card.</div>
        )}
      </div>
      )}

      {/* ─── iCal Export ─── */}
      <div className="int-section">
        <div className="int-section-head">
          <div>
            <div className="int-section-title">📤 Exportar pra outros calendários (.ics)</div>
            <div className="int-section-sub">Gera arquivo .ics com todos os cards que têm data — importe no Google Calendar, Apple Calendar, Outlook.</div>
          </div>
          <button className="btn btn-primary" onClick={exportIcs}>
            ⬇ Baixar .ics
          </button>
        </div>
        <div className="int-hint">
          💡 No Google Calendar: Configurações → Importar e exportar → Importar → escolhe o .ics.
        </div>
      </div>

      {/* ─── Webhooks (ativo) ─── */}
      <div className="int-section">
        <div className="int-section-head">
          <div>
            <div className="int-section-title">🔗 Webhooks (Discord, Slack, Zapier, n8n…)</div>
            <div className="int-section-sub">Dispara HTTP POST quando um card muda. URLs do Discord e Slack são formatadas automaticamente com embeds bonitos.</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowWebhookForm(s => !s)}>
            {showWebhookForm ? 'Cancelar' : '+ Novo webhook'}
          </button>
        </div>

        {showWebhookForm && (
          <div className="int-form">
            <div className="frow">
              <label className="flabel">Nome</label>
              <input className="finput" placeholder="Ex: Notificar Discord" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="frow">
              <label className="flabel">URL</label>
              <input className="finput" placeholder="https://discord.com/api/webhooks/... ou https://hooks.slack.com/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            </div>
            <div className="frow">
              <label className="flabel">Eventos</label>
              <div className="fchecks">
                {(Object.keys(EVENT_LABELS) as Evt[]).map(e => (
                  <label key={e} className={`chk-lbl${newEvents.includes(e) ? ' active' : ''}`} onClick={() => toggleEvent(e)}>
                    {EVENT_LABELS[e]}
                  </label>
                ))}
              </div>
            </div>
            <div className="mfoot">
              <button className="btn btn-primary" onClick={submitWebhook}>Criar webhook</button>
            </div>
          </div>
        )}

        {webhooks.length === 0 ? (
          <div className="int-empty">Nenhum webhook configurado.</div>
        ) : (
          <div className="webhook-list">
            {webhooks.map(w => (
              <div key={w.id} className="webhook-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="webhook-name">
                    {w.name}
                    <span className={`webhook-pill${w.enabled ? ' on' : ''}`}>
                      {w.enabled ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  <div className="webhook-url">{w.url}</div>
                  <div className="webhook-events">
                    {w.events.map(e => <span key={e} className="badge bmed">{EVENT_LABELS[e]}</span>)}
                  </div>
                </div>
                <div className="webhook-actions">
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => updateWebhook(w.id, { enabled: !w.enabled })}
                  >
                    {w.enabled ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    className="card-btn"
                    title="Deletar"
                    onClick={() => { if (confirm(`Deletar webhook "${w.name}"?`)) deleteWebhook(w.id); }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

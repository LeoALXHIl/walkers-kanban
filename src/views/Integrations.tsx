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
import { EMBEDDED_GOOGLE_CLIENT_ID } from '@/services/firebase';

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
  const lifetimeMode = useAuth(s => s.googleLifetimeMode);
  const reauthGoogle = useAuth(s => s.reauthGoogle);
  const startLifetimeOAuth = useAuth(s => s.startLifetimeOAuth);
  const clearLifetimeOAuth = useAuth(s => s.clearLifetimeOAuth);
  const [lifetimeClientId, setLifetimeClientId] = useState('');
  const [lifetimeClientSecret, setLifetimeClientSecret] = useState('');
  const [lifetimeShowSecret, setLifetimeShowSecret] = useState(false);
  const [lifetimeConnecting, setLifetimeConnecting] = useState(false);
  const [lifetimeAuthUrl, setLifetimeAuthUrl] = useState('');

  // Receive the auth URL from main process when OAuth starts (for copy/fallback)
  useEffect(() => {
    window.walkersAPI.onGoogleOAuthUrl((url) => setLifetimeAuthUrl(url));
  }, []);

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
    if (lifetimeMode) {
      return '🟢 Modo Persistente — renova sozinho indefinidamente (sem popups)';
    }
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
  }, [googleToken, tokenExpiresAt, now, lifetimeMode]);

  const connectLifetime = async () => {
    const id = lifetimeClientId.trim();
    if (!id) { toast.error('Cole o Client ID primeiro'); return; }
    const secret = lifetimeClientSecret.trim() || undefined;
    setLifetimeConnecting(true);
    setLifetimeAuthUrl('');
    try {
      await startLifetimeOAuth(id, secret);
      toast.success('Conectado em modo persistente ✓', { icon: '🔐', durationMs: 4000 });
      setLifetimeClientId('');
      setLifetimeClientSecret('');
      setLifetimeAuthUrl('');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao conectar', { durationMs: 8000 });
    } finally {
      setLifetimeConnecting(false);
      setLifetimeAuthUrl('');
    }
  };

  // Conecta direto no modo permanente usando o Client ID embutido (sem o usuário colar nada).
  const connectPersistent = async () => {
    if (!EMBEDDED_GOOGLE_CLIENT_ID) { toast.error('Client ID embutido ausente'); return; }
    setLifetimeConnecting(true);
    setLifetimeAuthUrl('');
    try {
      await startLifetimeOAuth(EMBEDDED_GOOGLE_CLIENT_ID);
      toast.success('Conectado de forma permanente ✓ — não expira mais', { icon: '🔐', durationMs: 5000 });
    } catch (e: any) {
      toast.error(e.message || 'Falha ao conectar', { durationMs: 8000 });
    } finally {
      setLifetimeConnecting(false);
      setLifetimeAuthUrl('');
    }
  };

  const cancelLifetime = async () => {
    await window.walkersAPI.googleOAuthCancel();
    setLifetimeConnecting(false);
    setLifetimeAuthUrl('');
    toast.info('Conexão cancelada');
  };

  const disconnectLifetime = async () => {
    if (!confirm('Desconectar modo persistente? Você vai precisar reconectar depois.')) return;
    await clearLifetimeOAuth();
    toast.info('Modo persistente desconectado', { icon: '🔌' });
  };

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
          {lifetimeMode ? (
            <button className="btn btn-ghost" onClick={disconnectLifetime}>
              🔌 Desconectar
            </button>
          ) : EMBEDDED_GOOGLE_CLIENT_ID ? (
            lifetimeConnecting ? (
              <button className="btn btn-ghost" onClick={cancelLifetime}>✕ Cancelar</button>
            ) : (
              <button className="btn btn-primary" onClick={connectPersistent}>
                🔐 {googleToken ? 'Tornar permanente (não expira)' : 'Conectar com Google (não expira)'}
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={reconnect}>
              {googleToken ? 'Reconectar' : 'Conectar (modo 1h)'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
          {lifetimeMode
            ? '🎉 Conexão permanente ativa — o app renova o token sozinho, indefinidamente, sem reconexão. Pra remover acesso: https://myaccount.google.com/permissions → revogue "Walkers Kanban Desktop".'
            : EMBEDDED_GOOGLE_CLIENT_ID
              ? '👆 Clique pra conectar de forma permanente. Você autoriza UMA vez no navegador e nunca mais precisa reconectar.'
              : 'O modo padrão (Firebase popup) expira em ~1 hora. Configure o Modo Persistente abaixo pra zero reconexão.'}
        </div>

        {/* Progresso do fluxo permanente (Client ID embutido) */}
        {lifetimeConnecting && EMBEDDED_GOOGLE_CLIENT_ID && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>
              ⏳ Aguardando autorização no navegador...
            </div>
            <div style={{ color: 'var(--text2)' }}>
              Se aparecer "<strong>Este app não foi verificado pelo Google</strong>":
              <ol style={{ paddingLeft: 20, marginTop: 6 }}>
                <li>Click em <strong>Avançado</strong></li>
                <li>Click em <strong>Acessar Walkers Kanban Desktop (não seguro)</strong></li>
                <li>Click em <strong>Continuar</strong> e aceita as permissões</li>
              </ol>
            </div>
            {lifetimeAuthUrl && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245,158,11,.3)' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>
                  O navegador não abriu? Copie a URL e cole manualmente:
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="finput" readOnly value={lifetimeAuthUrl} style={{ flex: 1, fontFamily: "'Geist Mono', monospace", fontSize: 10 }} onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => { navigator.clipboard.writeText(lifetimeAuthUrl); toast.success('URL copiada — cole no navegador'); }}>📋 Copiar</button>
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => window.walkersAPI.openExternal(lifetimeAuthUrl)}>🔗 Abrir</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fallback discreto: modo temporário de 1h */}
        {!lifetimeMode && EMBEDDED_GOOGLE_CLIENT_ID && !lifetimeConnecting && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: '4px 9px', marginTop: 10 }}
            onClick={reconnect}
          >
            Usar modo temporário de 1h (sem permanência)
          </button>
        )}
      </div>

      {/* ─── Lifetime OAuth Mode (config manual — só quando NÃO há Client ID embutido) ─── */}
      {!lifetimeMode && !EMBEDDED_GOOGLE_CLIENT_ID && (
        <div className="int-section" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,.08), rgba(236,72,153,.04))', borderColor: 'rgba(124,92,252,.3)' }}>
          <div className="int-section-head">
            <div>
              <div className="int-section-title">♾️ Modo Persistente (recomendado)</div>
              <div className="int-section-sub">
                {EMBEDDED_GOOGLE_CLIENT_ID
                  ? 'Conecte com Google uma vez e o app renova o token sozinho indefinidamente — zero interrupção.'
                  : 'Token renova SOZINHO usando refresh_token Google — sem popup, dura ~6 meses, ZERO interrupção.'}
              </div>
            </div>
            {EMBEDDED_GOOGLE_CLIENT_ID && (
              lifetimeConnecting ? (
                <button className="btn btn-ghost" onClick={cancelLifetime}>✕ Cancelar</button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => { setLifetimeClientId(EMBEDDED_GOOGLE_CLIENT_ID); setTimeout(connectLifetime, 50); }}
                >
                  🔐 Conectar Google (Persistente)
                </button>
              )
            )}
          </div>

          {!EMBEDDED_GOOGLE_CLIENT_ID && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                <strong>Configuração inicial (1 minuto, uma vez só):</strong>
                <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Abra <a href="#" onClick={(e) => { e.preventDefault(); window.walkersAPI.openExternal('https://console.cloud.google.com/apis/credentials?project=walkerskambam'); }} style={{ color: 'var(--accent)' }}>Google Cloud Console → Credenciais</a></li>
                  <li>Click <strong>+ CRIAR CREDENCIAIS → ID do cliente OAuth</strong></li>
                  <li>Tipo de aplicativo: <strong>Aplicativo para computador</strong> (Desktop app)</li>
                  <li>Nome: <code>Walkers Kanban Desktop</code></li>
                  <li>Click <strong>Criar</strong> — copia o <strong>Client ID</strong> (formato: <code>123-xxxxx.apps.googleusercontent.com</code>)</li>
                  <li>Cola abaixo e click <strong>Conectar</strong></li>
                </ol>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                <input
                  className="finput"
                  placeholder="Client ID — 123456789012-abc...xyz.apps.googleusercontent.com"
                  value={lifetimeClientId}
                  onChange={(e) => setLifetimeClientId(e.target.value)}
                  style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') connectLifetime(); }}
                  disabled={lifetimeConnecting}
                />

                {lifetimeShowSecret && (
                  <input
                    className="finput"
                    type="password"
                    placeholder="Client Secret (só se criou Web App em vez de Desktop App)"
                    value={lifetimeClientSecret}
                    onChange={(e) => setLifetimeClientSecret(e.target.value)}
                    style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 }}
                    disabled={lifetimeConnecting}
                  />
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 10, padding: '4px 9px' }}
                    onClick={() => setLifetimeShowSecret(s => !s)}
                    disabled={lifetimeConnecting}
                  >
                    {lifetimeShowSecret ? '− Esconder Client Secret' : '+ Tenho um Client Secret (Web App)'}
                  </button>
                  <div style={{ flex: 1 }} />
                  {lifetimeConnecting ? (
                    <button className="btn btn-ghost" onClick={cancelLifetime}>
                      ✕ Cancelar
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={connectLifetime} disabled={!lifetimeClientId.trim()}>
                      🔐 Conectar Persistente
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {lifetimeConnecting && (
            <div style={{ marginTop: 14, padding: 14, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, fontSize: 11, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>
                ⏳ Aguardando autorização no navegador...
              </div>
              <div style={{ color: 'var(--text2)' }}>
                Se aparecer "<strong>Este app não foi verificado pelo Google</strong>":
                <ol style={{ paddingLeft: 20, marginTop: 6 }}>
                  <li>Click em <strong>Avançado</strong> (canto inferior esquerdo)</li>
                  <li>Click em <strong>Acessar Walkers Kanban Desktop (não seguro)</strong></li>
                  <li>Click em <strong>Continuar</strong> e aceita as permissões</li>
                </ol>
              </div>
              {lifetimeAuthUrl && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245,158,11,.3)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>
                    O navegador não abriu? Copie a URL e cole manualmente:
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="finput"
                      readOnly
                      value={lifetimeAuthUrl}
                      style={{ flex: 1, fontFamily: "'Geist Mono', monospace", fontSize: 10 }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 10 }}
                      onClick={() => {
                        navigator.clipboard.writeText(lifetimeAuthUrl);
                        toast.success('URL copiada — cole no navegador');
                      }}
                    >
                      📋 Copiar
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 10 }}
                      onClick={() => window.walkersAPI.openExternal(lifetimeAuthUrl)}
                    >
                      🔗 Abrir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!lifetimeConnecting && (
            <div className="int-hint" style={{ marginTop: 10 }}>
              💡 Quando clicar Conectar, abre o navegador. Você autoriza UMA VEZ, fecha a aba, pronto — não precisa mais.
            </div>
          )}
        </div>
      )}

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

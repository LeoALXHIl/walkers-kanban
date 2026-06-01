import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useData, updateClientProfile, archiveClient, addTagToClient, removeTagFromClient } from '@/store/data';
import { aggregateClient, computeClient360 } from '@/services/clients';
import { listCalendarEvents, eventMeetingLink, type GoogleEvent } from '@/services/google';
import { CloseIcon, TrashIcon } from '@/services/icons';
import { pickHashColor } from '@/services/colors';
import { fmt, fmtTime, dueInfo } from '@/services/storage';
import { PortalManager } from './PortalManager';

type Tab = 'cards' | 'reunioes' | 'portal' | 'perfil' | 'atividade';

function brl(n: number): string {
  if (!n || isNaN(n)) return 'R$ 0';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function ClientDetailModal() {
  const key = useUI(s => s.clientDetailKey);
  const close = useUI(s => s.closeClientDetail);
  const openCardDetail = useUI(s => s.openDetail);
  const openNewCard = useUI(s => s.openNewCard);
  const openMeetingModal = useUI(s => s.openMeetingModal);
  const googleToken = useAuth(s => s.googleAccessToken);
  const data = useData(s => s.data);
  const [tab, setTab] = useState<Tab>('cards');
  const [clientEvents, setClientEvents] = useState<GoogleEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Editable profile fields
  const summary = useMemo(() => key ? aggregateClient(key, data) : null, [key, data]);
  const profile = summary?.profile;
  const stats = useMemo(() => summary ? computeClient360(summary, data) : null, [summary, data]);

  // Fetch this client's Google Calendar meetings (by attendee email)
  useEffect(() => {
    setClientEvents([]);
    if (!profile?.email || !googleToken) return;
    setLoadingEvents(true);
    // Window: 90 days back, 90 days forward
    const past = new Date(); past.setDate(past.getDate() - 90);
    const future = new Date(); future.setDate(future.getDate() + 90);
    listCalendarEvents(past, future)
      .then(items => {
        const lowerEmail = profile.email!.toLowerCase();
        const matched = items.filter(ev =>
          (ev.attendees || []).some(a => a.email?.toLowerCase() === lowerEmail) ||
          ev.description?.toLowerCase().includes(lowerEmail) ||
          ev.summary?.toLowerCase().includes(summary?.displayName.toLowerCase() || '###')
        );
        setClientEvents(matched);
      })
      .catch(() => setClientEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [key, profile?.email, googleToken]);

  const nextMeeting = useMemo(() => {
    const now = Date.now();
    return clientEvents
      .filter(ev => {
        const t = new Date(ev.start.dateTime || ev.start.date || '').getTime();
        return t >= now;
      })
      .sort((a, b) => {
        const ta = new Date(a.start.dateTime || a.start.date || '').getTime();
        const tb = new Date(b.start.dateTime || b.start.date || '').getTime();
        return ta - tb;
      })[0] || null;
  }, [clientEvents]);

  // Activity timeline (cards + meetings) — declared BEFORE any early-return so hooks order stays stable.
  const activityEvents = useMemo(() => {
    if (!summary) return [];
    const events: Array<{ ts: number; text: string; icon: string }> = [];
    summary.cards.forEach(c => {
      if (c.ts) events.push({ ts: c.ts, text: `Card criado: ${c.name}`, icon: '✨' });
      (c.comments || []).forEach(cm => {
        events.push({ ts: cm.ts, text: `Comentário em ${c.name}: "${cm.text.slice(0, 60)}${cm.text.length > 60 ? '…' : ''}"`, icon: '💬' });
      });
    });
    // Mix in meetings
    clientEvents.forEach(ev => {
      const t = new Date(ev.start.dateTime || ev.start.date || '').getTime();
      if (!isNaN(t)) {
        const isPast = t < Date.now();
        events.push({
          ts: t,
          text: `${isPast ? 'Reunião realizada' : 'Reunião agendada'}: ${ev.summary || '(sem título)'}`,
          icon: '📅'
        });
      }
    });
    return events.sort((a, b) => b.ts - a.ts).slice(0, 80);
  }, [summary, clientEvents]);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [site, setSite] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [totalBilled, setTotalBilled] = useState('');

  useEffect(() => {
    if (!summary) return;
    setDisplayName(summary.displayName);
    setPhone(profile?.phone || '');
    setEmail(profile?.email || '');
    setWhatsapp(profile?.social?.whatsapp || '');
    setInstagram(profile?.social?.instagram || '');
    setSite(profile?.social?.site || '');
    setNotes(profile?.notes || '');
    setTags((profile?.tags || []).join(', '));
    setHourlyRate(profile?.hourlyRate != null ? String(profile.hourlyRate) : '');
    setTotalBilled(profile?.totalBilled != null ? String(profile.totalBilled) : '');
    setTab('cards');
  }, [key]);

  if (!key || !summary) return null;

  const saveProfile = () => {
    updateClientProfile(summary.displayName, {
      displayName: displayName.trim() || summary.displayName,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      social: {
        whatsapp: whatsapp.trim() || undefined,
        instagram: instagram.trim() || undefined,
        site: site.trim() || undefined
      },
      notes: notes.trim() || undefined,
      // tags handled via ClientTagsEditor (tagIds); keep legacy tags as-is
      hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
      totalBilled: totalBilled ? Number(totalBilled) : undefined
    });
  };

  // Note: activityEvents is now declared earlier (before the conditional return) to keep hooks order stable.

  const colByName = (cid: string) => data.cols.find(c => c.id === cid)?.name || '—';

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal client-detail-modal">
        <div className="client-detail-head">
          <div className="client-detail-avatar" style={{ background: pickHashColor(summary.displayName) }}>
            {summary.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="client-detail-title-wrap">
            <input
              className="detail-title"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={saveProfile}
              placeholder="Nome do cliente"
            />
            <div className="detail-breadcrumb">
              {summary.totalCards} card{summary.totalCards === 1 ? '' : 's'} ·
              {summary.activeCards} ativo{summary.activeCards === 1 ? '' : 's'} ·
              {summary.doneCards} concluído{summary.doneCards === 1 ? '' : 's'}
              {summary.overdueCards > 0 && <> · <span style={{ color: 'var(--red)' }}>{summary.overdueCards} atrasado{summary.overdueCards === 1 ? '' : 's'}</span></>}
              {stats && stats.daysAsClient > 0 && <> · <span>cliente há {stats.daysAsClient}d</span></>}
            </div>
          </div>
          <div className="client-quick-actions">
            <button
              className="btn btn-ghost client-qa"
              title="Novo card pra este cliente"
              onClick={() => { close(); openNewCard(undefined, { name: summary.displayName }); }}
            >✨ Card</button>
            <button
              className="btn btn-ghost client-qa"
              title="Agendar reunião com este cliente"
              onClick={() => {
                close();
                openMeetingModal({
                  title: `Reunião — ${summary.displayName}`,
                  attendees: profile?.email ? [profile.email] : [],
                  durationMin: 30
                });
              }}
            >📅 Reunião</button>
            {profile?.email && (
              <button
                className="btn btn-ghost client-qa"
                title="Enviar email"
                onClick={() => window.walkersAPI.openExternal(`mailto:${profile.email}`)}
              >✉️ Email</button>
            )}
            {profile?.phone && (
              <button
                className="btn btn-ghost client-qa"
                title="Abrir WhatsApp"
                onClick={() => {
                  const phone = profile.phone!.replace(/\D/g, '');
                  window.walkersAPI.openExternal(`https://wa.me/${phone}`);
                }}
              >💬 WhatsApp</button>
            )}
          </div>
          <button className="detail-close" onClick={close}><CloseIcon /></button>
        </div>

        {/* ─── 360° Stats Grid ─── */}
        {stats && (
          <div className="client-stats-grid">
            <StatCard label="Total cards" value={String(summary.totalCards)} sub={`${summary.activeCards} ativos`} color="var(--accent)" />
            <StatCard label="Taxa de conclusão" value={`${stats.completionRate}%`} sub={`${summary.doneCards} concluídos`} color="var(--green)" />
            <StatCard label="Total faturado" value={brl(stats.totalBilled)} sub={stats.avgTicket > 0 ? `ticket: ${brl(stats.avgTicket)}` : 'sem ticket'} color="var(--green)" />
            <StatCard label="Valor/hora" value={stats.hourlyRate > 0 ? brl(stats.hourlyRate) : '—'} sub={stats.hourlyRate > 0 ? 'cadastrado' : 'sem valor'} color="var(--sky)" />
            <StatCard
              label="Próxima reunião"
              value={nextMeeting ? new Date(nextMeeting.start.dateTime || nextMeeting.start.date || '').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
              sub={nextMeeting ? new Date(nextMeeting.start.dateTime || nextMeeting.start.date || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'nenhuma'}
              color="var(--amber)"
            />
            <StatCard
              label="Crescimento 30d"
              value={`${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth}%`}
              sub={`${stats.cardsThisMonth} cards · vs ${stats.cardsLastMonth} anterior`}
              color={stats.monthlyGrowth >= 0 ? 'var(--green)' : 'var(--red)'}
            />
          </div>
        )}

        <div className="client-tabs">
          <button className={`client-tab${tab === 'cards' ? ' active' : ''}`} onClick={() => setTab('cards')}>Cards ({summary.totalCards})</button>
          <button className={`client-tab${tab === 'reunioes' ? ' active' : ''}`} onClick={() => setTab('reunioes')}>📅 Reuniões ({clientEvents.length})</button>
          <button className={`client-tab${tab === 'portal' ? ' active' : ''}`} onClick={() => setTab('portal')}>🌐 Portal</button>
          <button className={`client-tab${tab === 'perfil' ? ' active' : ''}`} onClick={() => setTab('perfil')}>Perfil</button>
          <button className={`client-tab${tab === 'atividade' ? ' active' : ''}`} onClick={() => setTab('atividade')}>Atividade</button>
        </div>

        <div className="client-detail-body">
          {tab === 'cards' && (
            <div className="client-cards-list">
              {summary.cards.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                  Sem cards. <button className="btn btn-ghost" style={{ fontSize: 11, marginLeft: 8 }} onClick={() => { close(); openNewCard(undefined, { name: summary.displayName }); }}>+ Criar primeiro</button>
                </div>
              ) : summary.cards.map(c => {
                const di = dueInfo(c.due);
                return (
                  <div key={c.id} className="client-card-row" onClick={() => { close(); openCardDetail(c.id); }}>
                    <div className="task-dot" style={{ background: c.color || '#7c5cfc' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        {colByName(c.cid)} · {fmt(c.ts)}
                        {c.subtasks.length > 0 && <> · {c.subtasks.filter(s => s.done).length}/{c.subtasks.length} subtarefas</>}
                      </div>
                    </div>
                    {di && <span className={`card-due ${di.cls}`}>{di.label}</span>}
                  </div>
                );
              })}
              <button
                className="btn btn-ghost"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => { close(); openNewCard(undefined, { name: summary.displayName }); }}
              >
                + Novo card pra {summary.displayName}
              </button>
            </div>
          )}

          {tab === 'portal' && (
            <PortalManager clientKey={summary.key} clientDisplayName={summary.displayName} />
          )}

          {tab === 'perfil' && (
            <div className="client-profile-form">
              <div className="profile-grid">
                <div className="frow">
                  <label className="flabel">Telefone</label>
                  <input className="finput" value={phone} onChange={e => setPhone(e.target.value)} onBlur={saveProfile} placeholder="(11) 99999-9999" />
                </div>
                <div className="frow">
                  <label className="flabel">Email</label>
                  <input className="finput" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveProfile} placeholder="cliente@exemplo.com" />
                </div>
                <div className="frow">
                  <label className="flabel">WhatsApp</label>
                  <input className="finput" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} onBlur={saveProfile} placeholder="link wa.me/…" />
                </div>
                <div className="frow">
                  <label className="flabel">Instagram</label>
                  <input className="finput" value={instagram} onChange={e => setInstagram(e.target.value)} onBlur={saveProfile} placeholder="@usuario" />
                </div>
                <div className="frow">
                  <label className="flabel">Site</label>
                  <input className="finput" value={site} onChange={e => setSite(e.target.value)} onBlur={saveProfile} placeholder="https://…" />
                </div>
                <div className="frow">
                  <label className="flabel">Tags</label>
                  <ClientTagsEditor clientKey={summary.key} />
                </div>
                <div className="frow">
                  <label className="flabel">Valor/hora (R$)</label>
                  <input className="finput" type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} onBlur={saveProfile} placeholder="120" />
                </div>
                <div className="frow">
                  <label className="flabel">Total faturado (R$)</label>
                  <input className="finput" type="number" value={totalBilled} onChange={e => setTotalBilled(e.target.value)} onBlur={saveProfile} placeholder="0" />
                </div>
              </div>
              <div className="frow">
                <label className="flabel">Notas</label>
                <textarea className="ftxt" value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveProfile} placeholder="Tudo importante sobre esse cliente…" style={{ minHeight: 80 }} />
              </div>

              <div className="client-profile-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    archiveClient(summary.key, !profile?.archived);
                  }}
                >
                  {profile?.archived ? '📦 Desarquivar cliente' : '📦 Arquivar cliente'}
                </button>
              </div>
            </div>
          )}

          {tab === 'reunioes' && (
            <div className="client-meetings-list">
              {!profile?.email && (
                <div style={{ padding: 16, color: 'var(--amber)', fontSize: 12, background: 'rgba(245,158,11,.08)', borderRadius: 8, marginBottom: 12 }}>
                  💡 Adicione o email do cliente na aba Perfil pra eu sincronizar as reuniões automaticamente do Google Calendar.
                </div>
              )}
              {!googleToken && (
                <div style={{ padding: 16, color: 'var(--amber)', fontSize: 12, background: 'rgba(245,158,11,.08)', borderRadius: 8, marginBottom: 12 }}>
                  Conecte com Google Calendar em Integrações pra ver as reuniões aqui.
                </div>
              )}
              {profile?.email && googleToken && loadingEvents && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Buscando reuniões…</div>
              )}
              {profile?.email && googleToken && !loadingEvents && clientEvents.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                  Sem reuniões com {summary.displayName} nos últimos/próximos 90 dias.
                </div>
              )}
              {clientEvents.length > 0 && (() => {
                const now = Date.now();
                const sorted = [...clientEvents].sort((a, b) => {
                  const ta = new Date(a.start.dateTime || a.start.date || '').getTime();
                  const tb = new Date(b.start.dateTime || b.start.date || '').getTime();
                  return tb - ta;
                });
                const upcoming = sorted.filter(ev => new Date(ev.start.dateTime || ev.start.date || '').getTime() >= now).reverse();
                const past = sorted.filter(ev => new Date(ev.start.dateTime || ev.start.date || '').getTime() < now);
                return (
                  <>
                    {upcoming.length > 0 && (
                      <>
                        <div className="client-meetings-section">Próximas ({upcoming.length})</div>
                        {upcoming.map(ev => <MeetingRow key={ev.id} ev={ev} isPast={false} />)}
                      </>
                    )}
                    {past.length > 0 && (
                      <>
                        <div className="client-meetings-section">Passadas ({past.length})</div>
                        {past.map(ev => <MeetingRow key={ev.id} ev={ev} isPast={true} />)}
                      </>
                    )}
                  </>
                );
              })()}
              <button
                className="btn btn-primary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={() => {
                  close();
                  openMeetingModal({
                    title: `Reunião — ${summary.displayName}`,
                    attendees: profile?.email ? [profile.email] : [],
                    durationMin: 30
                  });
                }}
              >
                📅 Agendar nova reunião
              </button>
            </div>
          )}

          {tab === 'atividade' && (
            <div className="client-activity-list">
              {activityEvents.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Sem atividade ainda.</div>
              ) : activityEvents.map((e, i) => (
                <div key={i} className="client-activity-row">
                  <div className="client-activity-icon">{e.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{e.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtTime(e.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function ClientTagsEditor({ clientKey }: { clientKey: string }) {
  const allTags = useData(s => s.data.tags);
  const profile = useData(s => s.data.clientProfiles?.[clientKey]);
  const tagIds = profile?.tagIds || [];
  const [input, setInput] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const myTags = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as Array<{ id: string; name: string; color: string }>;
  const availableTags = allTags.filter(t => !tagIds.includes(t.id));

  const addByName = (name: string) => {
    const t = name.trim();
    if (!t) return;
    addTagToClient(clientKey, t);
    setInput('');
    setShowPicker(false);
  };

  return (
    <div className="tag-editor">
      {myTags.map(t => (
        <span key={t.id} className="tag-chip" style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}55` }}>
          {t.name}
          <span className="tx" onClick={() => removeTagFromClient(clientKey, t.id)}>✕</span>
        </span>
      ))}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <span className="tag-add-btn" onClick={() => { setShowPicker(s => !s); setTimeout(() => inputRef.current?.focus(), 30); }}>
          + tag
        </span>
        {showPicker && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--rs)', padding: 6, zIndex: 100, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
            <input
              ref={inputRef}
              className="finput"
              placeholder="Nova tag ou busca…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && input.trim()) {
                  e.preventDefault();
                  addByName(input);
                } else if (e.key === 'Escape') {
                  setShowPicker(false); setInput('');
                }
              }}
              style={{ fontSize: 12, marginBottom: 6 }}
            />
            {availableTags.filter(t => t.name.toLowerCase().includes(input.toLowerCase())).slice(0, 6).map(t => (
              <button
                key={t.id}
                className="bm-item"
                onClick={() => { addTagToClient(clientKey, t.name); setShowPicker(false); setInput(''); }}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{t.name}</span>
              </button>
            ))}
            {input.trim() && !availableTags.find(t => t.name.toLowerCase() === input.toLowerCase().trim()) && (
              <button
                className="bm-item"
                onClick={() => addByName(input)}
                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--accent)' }}
              >
                <span>➕</span>
                <span style={{ flex: 1, textAlign: 'left' }}>Criar "{input.trim()}"</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="client-stat">
      <div className="client-stat-label">{label}</div>
      <div className="client-stat-value" style={{ color: color || 'var(--text)' }}>{value}</div>
      {sub && <div className="client-stat-sub">{sub}</div>}
    </div>
  );
}

function MeetingRow({ ev, isPast }: { ev: GoogleEvent; isPast: boolean }) {
  const start = new Date(ev.start.dateTime || ev.start.date || '');
  const end = ev.end.dateTime ? new Date(ev.end.dateTime) : null;
  const time = ev.start.dateTime
    ? start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : 'dia todo';
  const endTime = end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const link = eventMeetingLink(ev);
  const dateStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  return (
    <div className={`client-meeting-row${isPast ? ' past' : ''}`}>
      <div className="client-meeting-date">
        <div style={{ fontSize: 11, fontWeight: 600, color: isPast ? 'var(--text3)' : 'var(--accent)' }}>{dateStr}</div>
        <div style={{ fontSize: 10, color: 'var(--text2)' }}>{time}{endTime ? ` – ${endTime}` : ''}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{ev.summary || '(sem título)'}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          {(ev.attendees || []).length > 0 && <>👥 {(ev.attendees || []).length} convidado{(ev.attendees || []).length > 1 ? 's' : ''}</>}
          {link && <span style={{ color: '#22c55e', marginLeft: 8 }}>🎥 Meet</span>}
        </div>
      </div>
      {link && !isPast && (
        <button
          className="btn btn-primary"
          onClick={() => window.walkersAPI.openExternal(link)}
          style={{ fontSize: 11, padding: '5px 11px' }}
        >
          Entrar
        </button>
      )}
    </div>
  );
}

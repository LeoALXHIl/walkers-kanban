import { useEffect, useMemo, useState } from 'react';
import { useData, updateCard } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { listCalendarEvents, eventMeetingLink, GoogleAuthError, type GoogleEvent } from '@/services/google';
import { toast } from '@/services/toast';
import { on as onEvent } from '@/services/events';
import type { Card } from '@/types';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(year: number, month: number): Date[] {
  // 6×7 grid starting on Monday
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // 0=Mon..6=Sun
  const start = new Date(year, month, 1 - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarView() {
  const data = useData(s => s.data);
  const openCardDetail = useUI(s => s.openDetail);
  const openNewCard = useUI(s => s.openNewCard);
  const openEventDetail = useUI(s => s.openEventDetail);
  const openMeetingModal = useUI(s => s.openMeetingModal);
  const googleToken = useAuth(s => s.googleAccessToken);
  const reauthGoogle = useAuth(s => s.reauthGoogle);

  const today = new Date(); today.setHours(0,0,0,0);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [googleError, setGoogleError] = useState<string>('');
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  // Build map: dateKey → cards with that due date (filtered by active board)
  const cardsByDate = useMemo(() => {
    const map = new Map<string, Card[]>();
    data.cards.forEach(c => {
      if (!c.due) return;
      if (c.boardId && c.boardId !== data.activeBoardId) return;
      if (c.archived) return;
      if (!map.has(c.due)) map.set(c.due, []);
      map.get(c.due)!.push(c);
    });
    return map;
  }, [data.cards, data.activeBoardId]);

  // Build map: dateKey → Google events for that day
  const eventsByDate = useMemo(() => {
    const map = new Map<string, GoogleEvent[]>();
    events.forEach(ev => {
      const start = ev.start.dateTime || ev.start.date;
      if (!start) return;
      const d = new Date(start);
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  // Fetch Google events when token + range change (also re-fetches when refreshTick changes)
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (!googleToken) { setEvents([]); return; }
    setLoadingEvents(true);
    setGoogleError('');
    const rangeStart = grid[0];
    const rangeEnd = new Date(grid[grid.length - 1]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    listCalendarEvents(rangeStart, rangeEnd)
      .then(items => setEvents(items))
      .catch((e: any) => {
        if (e instanceof GoogleAuthError) {
          if (e.reason === 'expired' || e.reason === 'no-token') {
            setGoogleError('Sessão Google expirou — reconecte abaixo.');
          } else {
            setGoogleError(e.message);
          }
        } else {
          setGoogleError(e.message || 'Erro');
        }
        setEvents([]);
      })
      .finally(() => setLoadingEvents(false));
  }, [cursor, googleToken, refreshTick]);

  // Listen for meeting-created events to refresh the calendar grid
  useEffect(() => {
    return onEvent('calendar:refresh', () => setRefreshTick(t => t + 1));
  }, []);

  const nav = (delta: number) => {
    let { year, month } = cursor;
    month += delta;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    setCursor({ year, month });
  };

  const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() });

  const reconnect = async () => {
    const tk = await reauthGoogle();
    if (tk) {
      setGoogleError('');
      toast.success('Reconectado com Google ✓');
    } else {
      toast.error('Falha ao reconectar');
    }
  };

  const handleDayClick = (d: Date) => {
    // Click on a day cell → open meeting modal pre-filled with that date
    const pad = (n: number) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    openMeetingModal({ date: ymd, durationMin: 30 });
  };

  const handleDrop = (d: Date) => {
    if (!dragCardId) return;
    const newDue = dateKey(d);
    updateCard(dragCardId, { due: newDue });
    setDragCardId(null);
    toast.info(`Card remarcado pra ${d.toLocaleDateString('pt-BR')}`, { icon: '📅' });
  };

  const joinMeeting = (ev: GoogleEvent) => {
    const link = eventMeetingLink(ev);
    if (link) {
      window.walkersAPI.openExternal(link);
    } else if (ev.htmlLink) {
      window.walkersAPI.openExternal(ev.htmlLink);
    } else {
      toast.error('Esse evento não tem link de reunião');
    }
  };

  return (
    <div className="calendar-view">
      <div className="cal-head">
        <div className="cal-title">{MONTHS[cursor.month]} {cursor.year}</div>
        <div className="cal-nav">
          <button className="btn btn-ghost" onClick={() => nav(-1)} title="Mês anterior">‹</button>
          <button className="btn btn-ghost" onClick={goToday}>Hoje</button>
          <button className="btn btn-ghost" onClick={() => nav(1)} title="Próximo mês">›</button>
        </div>
        <div className="cal-mode-toggle">
          <button className={`cal-mode-btn${viewMode === 'month' ? ' active' : ''}`} onClick={() => setViewMode('month')}>Mês</button>
          <button className={`cal-mode-btn${viewMode === 'agenda' ? ' active' : ''}`} onClick={() => setViewMode('agenda')}>Agenda</button>
        </div>
        <div style={{ flex: 1 }} />
        {!googleToken && (
          <button className="btn btn-primary" onClick={reconnect}>
            🔗 Conectar Google Calendar
          </button>
        )}
        {googleToken && (
          <>
            <span className="cal-google-status">
              ✓ Google · {loadingEvents ? 'sincronizando…' : `${events.length} evento(s)`}
            </span>
            <button className="btn btn-primary" onClick={() => openMeetingModal()} style={{ fontSize: 13, padding: '8px 14px' }}>
              📅 Nova reunião
            </button>
          </>
        )}
      </div>

      {/* ─── Próximas reuniões (sempre visível) ─── */}
      {googleToken && (() => {
        const now = new Date();
        const horizon = new Date(now.getTime() + 7 * 86400_000);
        const upcoming = events
          .filter(ev => {
            const start = ev.start.dateTime || ev.start.date;
            if (!start) return false;
            const t = new Date(start);
            return t >= now && t <= horizon;
          })
          .sort((a, b) => {
            const ta = new Date(a.start.dateTime || a.start.date || '').getTime();
            const tb = new Date(b.start.dateTime || b.start.date || '').getTime();
            return ta - tb;
          })
          .slice(0, 6);
        if (upcoming.length === 0) return null;
        const todayKey = dateKey(today);
        const tomorrowKey = dateKey(new Date(today.getTime() + 86400_000));
        const relativeDate = (d: Date) => {
          const k = dateKey(d);
          if (k === todayKey) return 'Hoje';
          if (k === tomorrowKey) return 'Amanhã';
          return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
        };
        return (
          <div className="cal-upcoming">
            <div className="cal-upcoming-title">Próximas reuniões · 7 dias</div>
            <div className="cal-upcoming-list">
              {upcoming.map(ev => {
                const start = new Date(ev.start.dateTime || ev.start.date || '');
                const end = ev.end.dateTime ? new Date(ev.end.dateTime) : null;
                const time = ev.start.dateTime
                  ? start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : 'dia todo';
                const endTime = end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                const link = eventMeetingLink(ev);
                const attendeeCount = (ev.attendees || []).length;
                return (
                  <div key={ev.id} className="cal-up-item" onClick={() => openEventDetail(ev)}>
                    <div className="cal-up-when">
                      <div className="cal-up-date">{relativeDate(start)}</div>
                      <div className="cal-up-time">{time}{endTime ? ` – ${endTime}` : ''}</div>
                    </div>
                    <div className="cal-up-body">
                      <div className="cal-up-name">{ev.summary || '(sem título)'}</div>
                      <div className="cal-up-meta">
                        {attendeeCount > 0 && <span>👥 {attendeeCount} convidado{attendeeCount > 1 ? 's' : ''}</span>}
                        {link && <span style={{ color: '#22c55e' }}>🎥 Meet</span>}
                      </div>
                    </div>
                    {link && (
                      <button
                        className="btn btn-primary cal-up-join"
                        onClick={(e) => { e.stopPropagation(); window.walkersAPI.openExternal(link); }}
                        title="Entrar na reunião"
                      >
                        Entrar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {googleError && (
        <div className="cal-error">
          {googleError} <button className="btn btn-ghost" style={{ marginLeft: 8, fontSize: 11 }} onClick={reconnect}>Reconectar</button>
        </div>
      )}

      {viewMode === 'agenda' && (
        <div className="cal-agenda">
          {(() => {
            // Group events by date within the current month
            const monthStart = new Date(cursor.year, cursor.month, 1);
            const monthEnd = new Date(cursor.year, cursor.month + 1, 0, 23, 59, 59);
            const list = events
              .filter(ev => {
                const t = new Date(ev.start.dateTime || ev.start.date || '');
                return t >= monthStart && t <= monthEnd;
              })
              .sort((a, b) => {
                const ta = new Date(a.start.dateTime || a.start.date || '').getTime();
                const tb = new Date(b.start.dateTime || b.start.date || '').getTime();
                return ta - tb;
              });
            if (list.length === 0) {
              return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>Nenhuma reunião neste mês.</div>;
            }
            const byDay = new Map<string, GoogleEvent[]>();
            list.forEach(ev => {
              const k = dateKey(new Date(ev.start.dateTime || ev.start.date || ''));
              if (!byDay.has(k)) byDay.set(k, []);
              byDay.get(k)!.push(ev);
            });
            const todayKey = dateKey(today);
            return Array.from(byDay.entries()).map(([k, evs]) => {
              const d = new Date(k + 'T00:00:00');
              const isPast = d < today;
              const isToday = k === todayKey;
              const label = isToday ? 'Hoje' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
              return (
                <div key={k} className={`cal-agenda-day${isPast ? ' past' : ''}${isToday ? ' today' : ''}`}>
                  <div className="cal-agenda-date">{label}</div>
                  {evs.map(ev => {
                    const start = new Date(ev.start.dateTime || ev.start.date || '');
                    const end = ev.end.dateTime ? new Date(ev.end.dateTime) : null;
                    const time = ev.start.dateTime
                      ? start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'dia todo';
                    const endTime = end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                    const link = eventMeetingLink(ev);
                    const attendees = ev.attendees || [];
                    return (
                      <div key={ev.id} className="cal-agenda-row" onClick={() => openEventDetail(ev)}>
                        <div className="cal-agenda-time">{time}{endTime ? `\n${endTime}` : ''}</div>
                        <div className={`cal-agenda-content${link ? ' has-meeting' : ''}`}>
                          <div className="cal-agenda-name">{ev.summary || '(sem título)'}</div>
                          <div className="cal-agenda-meta">
                            {attendees.length > 0 && <span>👥 {attendees.length}</span>}
                            {ev.location && <span>📍 {ev.location.slice(0, 40)}</span>}
                            {link && <span style={{ color: '#22c55e' }}>🎥 Meet</span>}
                          </div>
                        </div>
                        {link && (
                          <button
                            className="btn btn-primary"
                            onClick={(e) => { e.stopPropagation(); window.walkersAPI.openExternal(link); }}
                            style={{ fontSize: 11, padding: '5px 11px' }}
                          >
                            Entrar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>
      )}

      {viewMode === 'month' && (
      <>
      <div className="cal-weekdays">
        {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
      </div>

      <div className="cal-grid">
        {grid.map((d, i) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === cursor.month;
          const isToday = d.getTime() === today.getTime();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const cards = cardsByDate.get(key) || [];
          const evs = eventsByDate.get(key) || [];
          return (
            <div
              key={i}
              className={`cal-day${inMonth ? '' : ' out'}${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}`}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drop-target'); }}
              onDragLeave={e => e.currentTarget.classList.remove('drop-target')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drop-target'); handleDrop(d); }}
              onClick={() => inMonth && handleDayClick(d)}
            >
              <div className="cal-day-num">{d.getDate()}</div>
              <div className="cal-day-items">
                {evs.slice(0, 3).map(ev => {
                  const link = eventMeetingLink(ev);
                  const time = ev.start.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div
                      key={ev.id}
                      className={`cal-event${link ? ' has-meeting' : ''}`}
                      title={`${ev.summary || '(sem título)'}${time ? '\n🕐 ' + time : ''}${link ? '\n📞 ' + link : ''}\n\nClique pra ver detalhes`}
                      onClick={(e) => { e.stopPropagation(); openEventDetail(ev); }}
                    >
                      {link && <span className="cal-event-icon">🎥</span>}
                      {!link && <span className="cal-event-icon">📅</span>}
                      <div className="cal-event-content">
                        {time && <span className="cal-event-time">{time}</span>}
                        <span className="cal-event-name">{ev.summary || '(sem título)'}</span>
                      </div>
                    </div>
                  );
                })}
                {cards.slice(0, 2).map(c => (
                  <div
                    key={c.id}
                    className="cal-card-pill"
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); setDragCardId(c.id); }}
                    onDragEnd={() => setDragCardId(null)}
                    onClick={(e) => { e.stopPropagation(); openCardDetail(c.id); }}
                    style={{ background: `${c.color || '#7c5cfc'}22`, borderLeftColor: c.color || '#7c5cfc' }}
                    title={c.name}
                  >
                    {c.name}
                  </div>
                ))}
                {(cards.length + evs.length) > 5 && (
                  <div className="cal-more">+{cards.length + evs.length - 5} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      <div className="cal-legend">
        <span><span className="cal-legend-dot" style={{ background: 'var(--accent)' }} /> Cards do Walkers</span>
        <span><span className="cal-legend-icon">📞</span> Eventos com link de reunião</span>
        <span><span className="cal-legend-icon">📅</span> Eventos sem reunião</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 10 }}>Arraste cards entre dias pra remarcar</span>
      </div>
    </div>
  );
}

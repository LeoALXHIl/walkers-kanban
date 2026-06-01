import { useUI } from '@/store/ui';
import { eventMeetingLink, type GoogleEvent } from '@/services/google';
import { CloseIcon, VideoIcon, ExternalIcon, PeopleIcon, CalIcon } from '@/services/icons';
import { pickHashColor } from '@/services/colors';

function fmtRange(start: GoogleEvent['start'], end: GoogleEvent['end']): { dateStr: string; timeStr: string; isAllDay: boolean } {
  const startStr = start.dateTime || start.date || '';
  const endStr = end.dateTime || end.date || '';
  const isAllDay = !start.dateTime;
  try {
    const sd = new Date(startStr);
    const ed = new Date(endStr);
    const dateStr = sd.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (isAllDay) return { dateStr, timeStr: 'O dia todo', isAllDay: true };
    const fmtH = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return { dateStr, timeStr: `${fmtH(sd)} – ${fmtH(ed)}`, isAllDay: false };
  } catch {
    return { dateStr: startStr, timeStr: '', isAllDay: false };
  }
}

function detectProvider(ev: GoogleEvent): { name: string; emoji: string } {
  if (ev.hangoutLink || ev.conferenceData?.conferenceSolution?.name?.toLowerCase().includes('meet')) {
    return { name: 'Google Meet', emoji: '🟢' };
  }
  const link = eventMeetingLink(ev) || '';
  if (/zoom\.us|zoom\.com/i.test(link)) return { name: 'Zoom', emoji: '🔵' };
  if (/teams\.microsoft\.com/i.test(link)) return { name: 'Microsoft Teams', emoji: '🟣' };
  if (/whereby\.com/i.test(link)) return { name: 'Whereby', emoji: '🟠' };
  if (/meet\.google\.com/i.test(link)) return { name: 'Google Meet', emoji: '🟢' };
  if (link) return { name: 'Reunião online', emoji: '📞' };
  return { name: '', emoji: '📅' };
}

const RESPONSE_LABEL: Record<string, string> = {
  accepted: '✓ Aceito',
  declined: '✗ Recusou',
  tentative: '? Talvez',
  needsAction: '⏳ Sem resposta'
};

export function EventDetailModal() {
  const event = useUI(s => s.eventDetail) as GoogleEvent | null;
  const close = useUI(s => s.closeEventDetail);

  if (!event) return null;

  const range = fmtRange(event.start, event.end);
  const provider = detectProvider(event);
  const link = eventMeetingLink(event);
  const attendees = event.attendees || [];

  const join = () => {
    if (link) window.walkersAPI.openExternal(link);
  };

  const openInCal = () => {
    if (event.htmlLink) window.walkersAPI.openExternal(event.htmlLink);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal event-detail-modal">
        <div className="event-detail-head">
          <div className="event-detail-icon" style={{ background: link ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--bg4)' }}>
            {link ? <VideoIcon /> : <CalIcon />}
          </div>
          <div className="event-detail-title-wrap">
            <div className="event-detail-title">{event.summary || '(sem título)'}</div>
            <div className="event-detail-meta">
              <span className="event-detail-date">{range.dateStr}</span>
              {!range.isAllDay && <span className="event-detail-time">{range.timeStr}</span>}
              {provider.name && <span className="event-detail-provider">{provider.emoji} {provider.name}</span>}
            </div>
          </div>
          <button className="detail-close" onClick={close}><CloseIcon /></button>
        </div>

        <div className="event-detail-body">
          {link && (
            <div className="event-actions-primary">
              <button className="btn btn-primary event-join-btn" onClick={join}>
                <VideoIcon /> Entrar na reunião
              </button>
              <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(link)}>
                📋 Copiar link
              </button>
            </div>
          )}

          {event.location && (
            <div className="event-section">
              <div className="event-section-title">📍 Local</div>
              <div className="event-section-content">{event.location}</div>
            </div>
          )}

          {event.description && (
            <div className="event-section">
              <div className="event-section-title">📝 Descrição</div>
              <div className="event-section-content" style={{ whiteSpace: 'pre-wrap' }}>
                {stripHtmlForDisplay(event.description)}
              </div>
            </div>
          )}

          {attendees.length > 0 && (
            <div className="event-section">
              <div className="event-section-title"><PeopleIcon /> Participantes ({attendees.length})</div>
              <div className="event-attendees">
                {attendees.slice(0, 8).map((a, i) => (
                  <div key={i} className="event-attendee">
                    <div className="event-attendee-avatar" style={{ background: pickHashColor(a.displayName || a.email) }}>
                      {(a.displayName || a.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="event-attendee-body">
                      <div className="event-attendee-name">{a.displayName || a.email}</div>
                      <div className="event-attendee-status">{RESPONSE_LABEL[a.responseStatus || 'needsAction']}</div>
                    </div>
                  </div>
                ))}
                {attendees.length > 8 && (
                  <div className="event-attendee" style={{ color: 'var(--text3)' }}>+ {attendees.length - 8} mais</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="event-detail-foot">
          {event.htmlLink && (
            <button className="btn btn-ghost" onClick={openInCal}>
              <ExternalIcon /> Abrir no Google Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function stripHtmlForDisplay(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .trim();
}

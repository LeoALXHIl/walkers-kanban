import { useEffect, useState } from 'react';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { createCalendarEvent, GoogleAuthError } from '@/services/google';
import { toast } from '@/services/toast';
import { emit } from '@/services/events';

const DURATIONS = [15, 30, 45, 60, 90, 120];

function pad(n: number) { return String(n).padStart(2, '0'); }
function localDateYMD(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function nextHalfHourHM(d: Date) {
  const next = new Date(d);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

export function ScheduleMeetingModal() {
  const open = useUI(s => s.meetingModalOpen);
  const seed = useUI(s => s.meetingSeed);
  const close = useUI(s => s.closeMeetingModal);
  const googleToken = useAuth(s => s.googleAccessToken);
  const reauthGoogle = useAuth(s => s.reauthGoogle);
  const data = useData(s => s.data);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [attendeesInput, setAttendeesInput] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [createMeet, setCreateMeet] = useState(true);
  const [sendUpdates, setSendUpdates] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setTitle(seed?.title || '');
    setDescription(seed?.description || '');
    setDate(seed?.date || localDateYMD(now));
    setStartTime(seed?.startTime || nextHalfHourHM(now));
    setDurationMin(seed?.durationMin || 30);
    setAttendees(seed?.attendees || []);
    setAttendeesInput('');
    setCreateMeet(true);
    setSendUpdates(true);
    setSubmitting(false);
  }, [open, seed]);

  if (!open) return null;

  const addAttendeesFromInput = () => {
    const tokens = attendeesInput.split(/[\s,;]+/).map(s => s.trim()).filter(s => s && /\S+@\S+\.\S+/.test(s));
    if (tokens.length === 0) { setAttendeesInput(''); return; }
    setAttendees(prev => Array.from(new Set([...prev, ...tokens])));
    setAttendeesInput('');
  };

  const removeAttendee = (email: string) => {
    setAttendees(prev => prev.filter(e => e !== email));
  };

  const submit = async () => {
    if (!title.trim()) { toast.error('Coloca um título pra reunião'); return; }
    if (!date || !startTime) { toast.error('Data e hora são obrigatórios'); return; }
    if (!googleToken) { toast.error('Sem token Google. Conecte em Integrações.'); return; }

    // Add any text still in the input before submitting
    const pendingEmails = attendeesInput.split(/[\s,;]+/).map(s => s.trim()).filter(s => /\S+@\S+\.\S+/.test(s));
    const allAttendees = Array.from(new Set([...attendees, ...pendingEmails]));

    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = startTime.split(':').map(Number);
    const startDate = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMin * 60_000);

    // Description: append back-reference to card if scheduled from one
    let desc = description.trim();
    if (seed?.cardId) {
      const card = data.cards.find(c => c.id === seed.cardId);
      if (card) {
        const ref = `\n\n— Walkers Kanban —\nCard: ${card.name}`;
        if (!desc.includes('— Walkers Kanban —')) desc += ref;
      }
    }

    setSubmitting(true);
    try {
      const ev = await createCalendarEvent({
        summary: title.trim(),
        description: desc,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        attendeeEmails: allAttendees,
        createMeet,
        sendUpdates
      });
      const meetLink = ev.hangoutLink || ev.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri || null;
      if (meetLink) {
        toast.success('Reunião agendada 🎥 Link Meet copiado!', { durationMs: 4000 });
        try { await navigator.clipboard.writeText(meetLink); } catch {}
      } else {
        toast.success('Reunião agendada no Google Calendar', { icon: '📅', durationMs: 3500 });
      }
      // Tell the Calendar view to refetch
      emit('calendar:refresh', {});
      close();
    } catch (e: any) {
      if (e instanceof GoogleAuthError) {
        if (e.reason === 'expired' || e.reason === 'no-token') {
          toast.error('Sessão Google expirou. Reconectando…');
          try { await reauthGoogle(); } catch {}
        } else if (e.reason === 'forbidden') {
          toast.error('Sem permissão pra criar eventos. Reconecte Google em Integrações e aceite o novo escopo.');
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error(e.message || 'Erro ao criar reunião');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const linkedCard = seed?.cardId ? data.cards.find(c => c.id === seed.cardId) : null;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h2>📅 Agendar reunião</h2>
        {linkedCard && (
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: -6, marginBottom: 10, padding: '5px 9px', background: 'var(--bg3)', borderRadius: 'var(--rs)' }}>
            Vinculada ao card: <strong>{linkedCard.name}</strong>
          </div>
        )}

        <div className="frow">
          <label className="flabel">Título</label>
          <input
            className="finput"
            placeholder="Ex: Kickoff implementação cliente X"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div className="frow">
            <label className="flabel">Data</label>
            <input className="finput" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="frow">
            <label className="flabel">Hora</label>
            <input className="finput" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="frow">
            <label className="flabel">Duração</label>
            <select className="finput" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
              {DURATIONS.map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d/60}h${d%60 ? ' '+(d%60)+'min' : ''}`}</option>)}
            </select>
          </div>
        </div>

        <div className="frow">
          <label className="flabel">Descrição (opcional)</label>
          <textarea
            className="finput"
            rows={3}
            placeholder="Pauta, contexto, links…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="frow">
          <label className="flabel">Convidados (emails)</label>
          <div className="cf-input-row">
            <input
              className="finput"
              placeholder="cliente@exemplo.com (Enter pra adicionar)"
              value={attendeesInput}
              onChange={(e) => setAttendeesInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addAttendeesFromInput(); }
              }}
              onBlur={addAttendeesFromInput}
            />
          </div>
          {attendees.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {attendees.map(email => (
                <span key={email} className="tag-chip" style={{ background: 'rgba(124,92,252,.13)', color: 'var(--text)' }}>
                  {email}
                  <span className="tx" onClick={() => removeAttendee(email)}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="frow" style={{ display: 'flex', gap: 16, flexDirection: 'row', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={createMeet} onChange={(e) => setCreateMeet(e.target.checked)} />
            🎥 Criar link do Google Meet
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={sendUpdates} onChange={(e) => setSendUpdates(e.target.checked)} />
            ✉️ Notificar convidados por email
          </label>
        </div>

        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close} disabled={submitting}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Agendando…' : '📅 Agendar'}
          </button>
        </div>
      </div>
    </div>
  );
}

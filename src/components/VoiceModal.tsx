import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { CloseIcon } from '@/services/icons';
import { isVoiceSupported, startVoice, type VoiceController } from '@/services/voice';
import { parseTranscript } from '@/services/parser';

export function VoiceModal() {
  const open = useUI(s => s.voiceOpen);
  const close = useUI(s => s.closeVoice);
  const openNewCard = useUI(s => s.openNewCard);

  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const ctrlRef = useRef<VoiceController | null>(null);

  useEffect(() => {
    if (!open) return;
    setTranscript(''); setInterim(''); setError(''); setListening(false);
    setSupported(isVoiceSupported());
    if (!isVoiceSupported()) return;

    const ctrl = startVoice({
      onStart: () => setListening(true),
      onInterim: (t) => setInterim(t),
      onFinal: (t) => setTranscript(t),
      onError: (msg) => { if (msg) setError(msg); setListening(false); },
      onEnd: () => setListening(false)
    });
    ctrlRef.current = ctrl;
    ctrl.start();

    return () => {
      try { ctrl.abort(); } catch {}
    };
  }, [open]);

  if (!open) return null;

  const stop = () => ctrlRef.current?.stop();
  const restart = () => {
    setTranscript(''); setInterim(''); setError('');
    ctrlRef.current?.abort();
    setTimeout(() => ctrlRef.current?.start(), 50);
  };

  const createCard = () => {
    const text = (transcript || interim).trim();
    if (!text) return;
    const parsed = parseTranscript(text);
    close();
    openNewCard(undefined, {
      name: parsed.name,
      note: parsed.note,
      plat: parsed.plat,
      prio: parsed.prio,
      due: parsed.due
    });
  };

  const displayed = transcript || interim;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal voice-modal">
        <div className="voice-head">
          <div>
            <div className="voice-eyebrow">Voice → Card</div>
            <h2 className="voice-title">Fale e o card aparece</h2>
          </div>
          <button className="detail-close" onClick={close}><CloseIcon /></button>
        </div>

        <div className="voice-body">
          <div className={`voice-mic${listening ? ' is-listening' : ''}`}>
            <svg viewBox="0 0 24 24" width="56" height="56" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/>
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="voice-mic-rings">
              <span /><span /><span />
            </div>
          </div>

          {!supported ? (
            <div className="voice-error">
              Reconhecimento de voz não suportado neste Electron.<br />
              <small>Algumas builds do Chromium não incluem o engine de fala. Tente Google Chrome direto ou digite manualmente.</small>
            </div>
          ) : error ? (
            <div className="voice-error">{error}</div>
          ) : (
            <div className="voice-transcript">
              {displayed || <span className="voice-placeholder">{listening ? 'Pode falar… (ex: "Cliente Maria, WhatsApp, urgente, integração Magazord, amanhã")' : 'Iniciando…'}</span>}
            </div>
          )}
        </div>

        <div className="voice-foot">
          <button className="btn btn-ghost" onClick={restart} disabled={!supported}>↺ Recomeçar</button>
          {listening ? (
            <button className="btn btn-ghost" onClick={stop}>Parar</button>
          ) : (
            <button className="btn btn-ghost" onClick={() => ctrlRef.current?.start()} disabled={!supported}>Continuar</button>
          )}
          <button className="btn btn-primary" onClick={createCard} disabled={!displayed.trim()}>
            Criar card →
          </button>
        </div>
      </div>
    </div>
  );
}

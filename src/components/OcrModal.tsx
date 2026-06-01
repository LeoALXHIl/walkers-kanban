import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { CloseIcon } from '@/services/icons';
import { recognizeImage } from '@/services/ocr';
import { parseTranscript } from '@/services/parser';

type Phase = 'idle' | 'loading' | 'ocr' | 'done' | 'error';

export function OcrModal() {
  const open = useUI(s => s.ocrOpen);
  const close = useUI(s => s.closeOcr);
  const openNewCard = useUI(s => s.openNewCard);
  const consumePending = useUI(s => s.consumePendingOcrBlob);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPhase('idle'); setProgress(0); setStatus(''); setText(''); setError('');
    setImageUrl('');
    // If the user pasted an image globally, it's already queued — auto-process
    const queued = consumePending();
    if (queued) {
      setTimeout(() => handleImage(queued), 30);
    }
  }, [open]);

  // Listen for pasted images while modal is open
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) { handleImage(blob); e.preventDefault(); return; }
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [open]);

  const handleImage = async (blob: Blob | File) => {
    setImageUrl(URL.createObjectURL(blob));
    setPhase('loading');
    setError(''); setText(''); setProgress(0); setStatus('Inicializando OCR…');
    try {
      const result = await recognizeImage(blob, {
        lang: 'por',
        onProgress: (info) => {
          const niceStatus = mapStatus(info.status);
          if (niceStatus) setStatus(niceStatus);
          if (info.status === 'recognizing text') setPhase('ocr');
          setProgress(info.progress || 0);
        }
      });
      setText(result.text);
      setPhase('done');
    } catch (e: any) {
      setError(e.message || 'Erro no OCR');
      setPhase('error');
    }
  };

  const onPick = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImage(file);
  };

  const createCard = () => {
    const t = text.trim();
    if (!t) return;
    const parsed = parseTranscript(t);
    close();
    openNewCard(undefined, {
      name: parsed.name,
      note: parsed.note,
      plat: parsed.plat,
      prio: parsed.prio,
      due: parsed.due
    });
  };

  if (!open) return null;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal ocr-modal">
        <div className="voice-head">
          <div>
            <div className="voice-eyebrow">OCR → Card</div>
            <h2 className="voice-title">Cole um print → vira card</h2>
          </div>
          <button className="detail-close" onClick={close}><CloseIcon /></button>
        </div>

        <div className="ocr-body">
          {phase === 'idle' && (
            <div className="ocr-drop">
              <div className="ocr-drop-emoji">📸</div>
              <div className="ocr-drop-title">Cole uma imagem (Ctrl+V)</div>
              <div className="ocr-drop-sub">ou clique pra selecionar do disco</div>
              <button className="btn btn-ghost" onClick={onPick} style={{ marginTop: 14 }}>Selecionar imagem</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
              <div className="ocr-hint">Funciona com prints de WhatsApp, Instagram, sites, fotos. Primeira vez baixa ~5MB do modelo de português.</div>
            </div>
          )}

          {(phase === 'loading' || phase === 'ocr') && (
            <div className="ocr-loading">
              {imageUrl && <img src={imageUrl} alt="" className="ocr-preview" />}
              <div className="ocr-progress">
                <div className="ocr-progress-bar"><div className="ocr-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <div className="ocr-status">{status} · {Math.round(progress * 100)}%</div>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <>
              {imageUrl && <img src={imageUrl} alt="" className="ocr-preview" />}
              <div className="ocr-result-label">Texto extraído (editável):</div>
              <textarea
                className="ocr-result"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </>
          )}

          {phase === 'error' && (
            <div className="voice-error">{error}</div>
          )}
        </div>

        <div className="voice-foot">
          {phase === 'done' && (
            <button className="btn btn-ghost" onClick={() => { setPhase('idle'); setText(''); setImageUrl(''); }}>
              Outra imagem
            </button>
          )}
          {phase === 'done' && (
            <button className="btn btn-primary" onClick={createCard} disabled={!text.trim()}>
              Criar card com este texto →
            </button>
          )}
          {phase !== 'done' && (
            <button className="btn btn-ghost" onClick={close}>Fechar</button>
          )}
        </div>
      </div>
    </div>
  );
}

function mapStatus(s: string): string {
  switch (s) {
    case 'loading tesseract core': return 'Baixando OCR engine…';
    case 'initializing tesseract': return 'Inicializando…';
    case 'loading language traineddata': return 'Baixando português…';
    case 'initializing api': return 'Preparando…';
    case 'recognizing text': return 'Lendo a imagem…';
    default: return s || '…';
  }
}

import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { CloseIcon } from '@/services/icons';
import { renderSnapshot, copyCanvasToClipboard, downloadCanvas } from '@/services/snapshot';

const TITLES = {
  streak: 'Snapshot do meu streak',
  weekly: 'Snapshot da semana',
  achievement: 'Snapshot da conquista'
} as const;

export function SnapshotModal() {
  const snap = useUI(s => s.snapshot);
  const close = useUI(s => s.closeSnapshot);
  const data = useData(s => s.data);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!snap) return;
    let cancelled = false;
    setBusy(true); setToast('');
    setPreviewUrl('');
    (async () => {
      try {
        const c = await renderSnapshot({
          kind: snap.kind,
          data,
          achievementId: snap.achievementId
        });
        if (cancelled) return;
        canvasRef.current = c;
        setPreviewUrl(c.toDataURL('image/png'));
      } catch (e) {
        if (!cancelled) setToast('Erro ao gerar imagem');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [snap, data]);

  if (!snap) return null;

  const onCopy = async () => {
    if (!canvasRef.current) return;
    try {
      await copyCanvasToClipboard(canvasRef.current);
      setToast('✓ Imagem copiada — cola direto no WhatsApp/LinkedIn/Insta');
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setToast(e.message || 'Erro ao copiar');
    }
  };

  const onDownload = async () => {
    if (!canvasRef.current) return;
    const name = `walkers-${snap.kind}-${new Date().toISOString().slice(0, 10)}.png`;
    await downloadCanvas(canvasRef.current, name);
    setToast('✓ PNG salvo em Downloads');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal snapshot-modal">
        <div className="voice-head">
          <div>
            <div className="voice-eyebrow">Compartilhar</div>
            <h2 className="voice-title">{TITLES[snap.kind]}</h2>
          </div>
          <button className="detail-close" onClick={close}><CloseIcon /></button>
        </div>

        <div className="snapshot-body">
          {busy && <div className="snapshot-skeleton">Gerando imagem…</div>}
          {previewUrl && (
            <img src={previewUrl} alt="" className="snapshot-preview" />
          )}
        </div>

        {toast && <div className="snapshot-toast">{toast}</div>}

        <div className="voice-foot">
          <button className="btn btn-ghost" onClick={onDownload} disabled={!previewUrl}>
            ⬇ Salvar PNG
          </button>
          <button className="btn btn-primary" onClick={onCopy} disabled={!previewUrl}>
            📋 Copiar imagem
          </button>
        </div>
      </div>
    </div>
  );
}

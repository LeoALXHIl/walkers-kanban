import { useEffect } from 'react';

interface Props {
  url: string;
  alt?: string;
  onClose: () => void;
}

export function Lightbox({ url, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Fechar">✕</button>
      <img src={url} alt={alt || ''} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

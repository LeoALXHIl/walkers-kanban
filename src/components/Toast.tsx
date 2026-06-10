import { useEffect, useState } from 'react';
import { on } from '@/services/events';
import type { ToastPayload } from '@/services/toast';

export function Toast() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  const dismiss = (id: string) => setItems(prev => prev.filter(x => x.id !== id));

  useEffect(() => {
    return on<ToastPayload>('toast', (payload) => {
      setItems(prev => [...prev, payload]);
      const ms = payload.durationMs || 3200;
      setTimeout(() => dismiss(payload.id), ms);
    });
  }, []);

  if (!items.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.variant}`}
          onClick={() => dismiss(t.id)}
        >
          {t.icon && <span className="toast-icon">{t.icon}</span>}
          <span className="toast-message">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="toast-action"
              onClick={(e) => { e.stopPropagation(); t.action!.onClick(); dismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

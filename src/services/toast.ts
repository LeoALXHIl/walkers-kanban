// Lightweight transient toast bus. Distinct from notifications (which persist
// in the inbox) and from AchievementToast (which is special-cased with confetti).
// Use for: card created/moved/deleted, sync errors, generic success/failure.
import { emit } from './events';

export type ToastVariant = 'info' | 'success' | 'error' | 'warn';

export interface ToastPayload {
  id: string;
  variant: ToastVariant;
  icon?: string;
  message: string;
  durationMs?: number;
  // UX-4: optional action button (e.g. "Desfazer" wired to the undo stack)
  action?: { label: string; onClick: () => void };
}

function genId() { return '_t' + Math.random().toString(36).slice(2, 9); }

export function toast(message: string, opts: Partial<Omit<ToastPayload, 'message' | 'id'>> = {}) {
  emit<ToastPayload>('toast', {
    id: genId(),
    message,
    variant: opts.variant || 'info',
    icon: opts.icon,
    durationMs: opts.durationMs ?? 3200,
    action: opts.action
  });
}

toast.success = (message: string, opts?: Partial<Omit<ToastPayload, 'message' | 'id' | 'variant'>>) =>
  toast(message, { ...opts, variant: 'success' });

toast.error = (message: string, opts?: Partial<Omit<ToastPayload, 'message' | 'id' | 'variant'>>) =>
  toast(message, { ...opts, variant: 'error' });

toast.warn = (message: string, opts?: Partial<Omit<ToastPayload, 'message' | 'id' | 'variant'>>) =>
  toast(message, { ...opts, variant: 'warn' });

toast.info = (message: string, opts?: Partial<Omit<ToastPayload, 'message' | 'id' | 'variant'>>) =>
  toast(message, { ...opts, variant: 'info' });

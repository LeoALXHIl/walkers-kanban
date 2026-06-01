// Drop-in replacement for window.prompt() that works reliably in Electron.
// Returns a Promise<string | null>. Renders a modal via global event bus.
import { emit, on } from './events';

export interface QuickPromptOpts {
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  rows?: number;
  okLabel?: string;
  cancelLabel?: string;
}

let resolveCurrent: ((v: string | null) => void) | null = null;

export function quickPrompt(opts: QuickPromptOpts | string = {}): Promise<string | null> {
  const normalized: QuickPromptOpts = typeof opts === 'string' ? { message: opts } : opts;
  // If a previous prompt is still open, cancel it
  if (resolveCurrent) {
    resolveCurrent(null);
    resolveCurrent = null;
  }
  return new Promise<string | null>((resolve) => {
    resolveCurrent = resolve;
    emit('quickprompt:open', normalized);
  });
}

// Internal: called by the renderer modal when user clicks OK/Cancel
export function _resolveQuickPrompt(value: string | null): void {
  if (resolveCurrent) {
    const fn = resolveCurrent;
    resolveCurrent = null;
    fn(value);
  }
  emit('quickprompt:close', {});
}

// For modal component to subscribe
export const onQuickPromptOpen = (fn: (opts: QuickPromptOpts) => void) => on('quickprompt:open', fn);

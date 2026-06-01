// Tiny event bus for cross-cutting UI signals that don't fit cleanly into
// Zustand state (toasts, transient notifications, etc.).
type Handler<T> = (payload: T) => void;
const listeners = new Map<string, Set<Handler<any>>>();

export function on<T = any>(event: string, fn: Handler<T>): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit<T = any>(event: string, payload: T): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); } catch (e) { console.warn('[events]', event, e); }
  }
}

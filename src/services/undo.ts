// UX-4: surface the global undo stack as a one-click "Desfazer" action inside a
// toast, so reversible destructive actions (archive card, delete column) can be
// recovered without knowing the Ctrl+Z shortcut. The undo stack is populated by
// data.apply(); calling this right after a mutation makes that mutation undoable.
import { toast } from './toast';
import { useData } from '@/store/data';

export function undoToast(message: string, opts: { icon?: string; durationMs?: number } = {}) {
  toast(message, {
    icon: opts.icon,
    variant: 'info',
    durationMs: opts.durationMs ?? 6000,
    action: {
      label: 'Desfazer',
      onClick: () => {
        const ok = useData.getState().undo();
        if (ok) toast.success('Desfeito', { icon: '↶', durationMs: 1500 });
        else toast.error('Nada pra desfazer', { durationMs: 1500 });
      }
    }
  });
}

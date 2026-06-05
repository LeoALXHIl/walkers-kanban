// Notifica o consultor quando o cliente interage no portal público (Sprint 4).
// In-app (store de notificações) + notificação de SO. Não depende de Functions/billing —
// usa os listeners Firestore que já existem.
import type { Unsubscribe } from 'firebase/firestore';
import { listSharesByOwner, subscribeComments, subscribeShare } from './publicShares';
import { useNotifications } from '@/store/notifications';

let unsubs: Unsubscribe[] = [];

const seenKey = (slug: string, kind: string) => `walkers.portal.seen.${kind}.${slug}`;
const getSeen = (slug: string, kind: string) => Number(localStorage.getItem(seenKey(slug, kind))) || 0;
const setSeen = (slug: string, kind: string, ts: number) => {
  try { localStorage.setItem(seenKey(slug, kind), String(ts)); } catch {}
};

function trunc(s: string, n = 80) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function notify(icon: string, title: string, sub: string, type: string) {
  useNotifications.getState().add({ type, icon, title, sub, ts: Date.now() });
  try { window.walkersAPI.showNotification(title, sub); } catch {}
}

export async function startPortalWatcher(ownerUid: string) {
  stopPortalWatcher();
  if (!ownerUid) return;

  let shares;
  try { shares = await listSharesByOwner(ownerUid); } catch { return; }

  for (const share of shares.slice(0, 40)) {
    // Comentários novos.
    unsubs.push(subscribeComments(share.slug, (comments) => {
      const seen = getSeen(share.slug, 'comment');
      const maxTs = comments.reduce((m, c) => Math.max(m, c.ts || 0), 0);
      if (maxTs <= seen) return;
      if (seen > 0) {
        comments.filter(c => (c.ts || 0) > seen).forEach(c => {
          notify('💬', `Novo comentário de ${c.author || 'Cliente'}`,
            `${share.clientDisplayName}: "${trunc(c.text)}"`, 'portal-comment');
        });
      }
      setSeen(share.slug, 'comment', maxTs); // primeira passada só estabelece a baseline
    }));

    // Aprovações novas.
    unsubs.push(subscribeShare(share.slug, (s) => {
      if (!s) return;
      const approvals = s.approvals || [];
      const seen = getSeen(share.slug, 'approval');
      const maxTs = approvals.reduce((m, a) => Math.max(m, a.approvedAt || 0), 0);
      if (maxTs <= seen) return;
      if (seen > 0) {
        approvals.filter(a => (a.approvedAt || 0) > seen).forEach(a => {
          notify('✅', `Etapa aprovada por ${a.approvedBy || 'Cliente'}`,
            `${s.clientDisplayName}${a.note ? `: "${trunc(a.note)}"` : ''}`, 'portal-approval');
        });
      }
      setSeen(share.slug, 'approval', maxTs);
    }));
  }
}

export function stopPortalWatcher() {
  unsubs.forEach(u => { try { u(); } catch {} });
  unsubs = [];
}

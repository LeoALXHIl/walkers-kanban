import { useEffect } from 'react';
import { useNotifications } from '@/store/notifications';
import { useUI } from '@/store/ui';
import { InboxIcon } from '@/services/icons';
import { fmtTime } from '@/services/storage';

export function InboxView() {
  const items = useNotifications(s => s.items);
  const markAllRead = useNotifications(s => s.markAllRead);
  const clear = useNotifications(s => s.clear);
  const open = useNotifications(s => s.open);
  const openDetail = useUI(s => s.openDetail);

  useEffect(() => {
    markAllRead();
  }, []);

  if (items.length === 0) {
    return (
      <div className="inbox-view">
        <div className="inbox-header">
          <div className="inbox-title">Caixa de Entrada</div>
        </div>
        <div className="inbox-empty">
          <InboxIcon />
          <h3>Tudo em dia!</h3>
          <p>Notificações de criação, movimentação de cards e sincronizações aparecerão aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-view">
      <div className="inbox-header">
        <div className="inbox-title">Caixa de Entrada</div>
        <button className="btn btn-ghost" onClick={clear} style={{ fontSize: 11 }}>Limpar tudo</button>
      </div>
      {items.map(n => (
        <div
          key={n.id}
          className={`notif-item${n.read ? '' : ' unread'}`}
          onClick={() => { const updated = open(n.id); if (updated?.cardId) openDetail(updated.cardId); }}
        >
          <div className="notif-icon" style={{ background: 'var(--bg3)' }}>{n.icon || '📋'}</div>
          <div className="notif-body">
            <div className="notif-title">{n.title}</div>
            <div className="notif-sub">{n.sub || ''}</div>
          </div>
          <div className="notif-time">{fmtTime(n.ts)}</div>
        </div>
      ))}
    </div>
  );
}

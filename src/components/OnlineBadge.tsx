import { useEffect, useState } from 'react';
import { isWebMode } from '@/services/browserBridge';

// Indicador de conexão. Reage a online/offline do navegador. Mostra "Web"
// quando rodando na versão browser (vs desktop).
export function OnlineBadge({ collapsed = false }: { collapsed?: boolean }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const web = isWebMode();
  const label = online ? (web ? 'Online · Web' : 'Online') : 'Offline';
  const title = online
    ? 'Conectado — sincronizando com a nuvem'
    : 'Sem conexão — alterações salvas localmente e enviadas ao reconectar';

  return (
    <div
      className="sb-online-badge"
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 8px', fontSize: 11, fontWeight: 600,
        color: online ? 'var(--text2, #8b8b9e)' : '#f59e0b',
        justifyContent: collapsed ? 'center' : 'flex-start'
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto',
        background: online ? '#22c55e' : '#f59e0b',
        boxShadow: online ? '0 0 0 3px rgba(34,197,94,.18)' : '0 0 0 3px rgba(245,158,11,.18)'
      }} />
      {!collapsed && <span>{label}</span>}
    </div>
  );
}

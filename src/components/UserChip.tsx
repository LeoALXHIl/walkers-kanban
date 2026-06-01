import { useAuth } from '@/store/auth';
import { LogoutIcon, SettingsIcon } from '@/services/icons';
import { pickHashColor } from '@/services/colors';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';

export function UserChip() {
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const teardown = useData(s => s.teardown);
  const openSettings = useUI(s => s.openSettings);

  if (!user) return null;

  const handleLogout = async () => {
    if (!confirm('Sair da conta?')) return;
    await teardown();
    await logout();
  };

  const email = user.email || user.displayName || 'usuário';
  const initials = (email || '?').slice(0, 2).toUpperCase();
  const bg = user.photoURL ? undefined : `linear-gradient(135deg, ${pickHashColor(email)}, ${pickHashColor(email + '.')})`;

  return (
    <div className="user-chip">
      <div className="user-chip-avatar" style={bg ? { background: bg } : undefined}>
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : initials}
      </div>
      <div className="user-chip-email" title={email}>{email}</div>
      <button className="user-chip-logout" onClick={openSettings} title="Configurações">
        <SettingsIcon />
      </button>
      <button className="user-chip-logout" onClick={handleLogout} title="Sair">
        <LogoutIcon />
      </button>
    </div>
  );
}

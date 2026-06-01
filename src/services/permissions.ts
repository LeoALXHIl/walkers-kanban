// Permission helpers based on the user's role in the active workspace.
// Use these to gate UI elements consistently across the app.
import { useWorkspace } from '@/store/workspace';
import type { WorkspaceRole } from '@/types';

// Hook — returns role string or null
export function useMyRole(): WorkspaceRole | null {
  return useWorkspace(s => s.currentWorkspace ? s.myRole() : null);
}

// Permission checks
// CRÍTICO: quando role é null (workspace ainda carregando ou Firestore Rules
// bloqueando), assumimos modo "single-user / owner" — caso contrário o app
// virtualmente bloqueia tudo pra você até o workspace carregar.
export function canEdit(role: WorkspaceRole | null): boolean {
  if (role === null) return true;
  return role !== 'viewer';
}
export function canManage(role: WorkspaceRole | null): boolean {
  if (role === null) return true;
  return role === 'owner' || role === 'admin';
}
export function canDeleteWorkspace(role: WorkspaceRole | null): boolean {
  if (role === null) return true;
  return role === 'owner';
}
export function canInvite(role: WorkspaceRole | null): boolean {
  if (role === null) return true;
  return role === 'owner' || role === 'admin';
}
export function canChangeRoles(role: WorkspaceRole | null): boolean {
  if (role === null) return true;
  return role === 'owner' || role === 'admin';
}
export function isViewer(role: WorkspaceRole | null): boolean {
  return role === 'viewer';  // null NÃO é viewer
}

// Convenience hook combining role + common checks
export function usePermissions() {
  const role = useMyRole();
  return {
    role,
    canEdit: canEdit(role),
    canManage: canManage(role),
    canDeleteWorkspace: canDeleteWorkspace(role),
    canInvite: canInvite(role),
    canChangeRoles: canChangeRoles(role),
    isViewer: isViewer(role),
    isOwner: role === 'owner',
    isAdmin: role === 'admin'
  };
}

export const ROLE_LABELS: Record<WorkspaceRole, { label: string; emoji: string; color: string }> = {
  owner:  { label: 'Dono',   emoji: '👑', color: '#f59e0b' },
  admin:  { label: 'Admin',  emoji: '🛠️', color: '#7c5cfc' },
  member: { label: 'Membro', emoji: '👤', color: '#22c55e' },
  viewer: { label: 'Viewer', emoji: '👁',  color: '#8b8fa8' }
};

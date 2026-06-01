import { create } from 'zustand';
import { auth } from '@/services/firebase';
import { ensureUserProfile, loadMyWorkspaces, createWorkspace, setActiveWorkspace, loadWorkspace, renameWorkspace, acceptInvite, createInvite, removeMember, updateMemberRole } from '@/services/workspaces';
import { useData } from './data';
import { toast } from '@/services/toast';
import type { Workspace, UserProfile, WorkspaceRole } from '@/types';

interface WorkspaceState {
  profile: UserProfile | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  modalOpen: boolean;
  joinModalOpen: boolean;
  newWsModalOpen: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  switchTo: (wsId: string) => Promise<void>;
  createNew: (name: string, emoji?: string) => Promise<void>;
  rename: (wsId: string, name: string, emoji?: string, color?: string) => Promise<void>;
  joinByCode: (wsId: string, code: string) => Promise<void>;
  invite: (role?: WorkspaceRole, email?: string) => Promise<string>;
  removeUser: (uid: string) => Promise<void>;
  changeRole: (uid: string, role: WorkspaceRole) => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  openJoinModal: () => void;
  closeJoinModal: () => void;
  openNewWsModal: () => void;
  closeNewWsModal: () => void;
  myRole: () => WorkspaceRole | null;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  profile: null,
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  error: null,
  modalOpen: false,
  joinModalOpen: false,
  newWsModalOpen: false,

  init: async () => {
    const user = auth.currentUser;
    if (!user) {
      set({ error: 'Sem usuário logado' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const profile = await ensureUserProfile(user);
      const workspaces = await loadMyWorkspaces(profile);
      let currentWorkspace = workspaces.find(w => w.id === profile.currentWorkspaceId) || workspaces[0] || null;
      if (!currentWorkspace) {
        const ws = await createWorkspace(user, 'Pessoal', '👤', '#7c5cfc');
        workspaces.push(ws);
        currentWorkspace = ws;
      }
      set({ profile, workspaces, currentWorkspace, loading: false });
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[ws] init failed', e);
      set({ loading: false, error: msg });
      if (msg.includes('permission') || msg.includes('Missing or insufficient')) {
        toast.error('Firestore Rules bloqueando workspaces. Veja CONFIGURAR-FIRESTORE.md', { durationMs: 8000 });
      } else {
        toast.error(`Workspace: ${msg.slice(0, 100)}`, { durationMs: 6000 });
      }
    }
  },

  refresh: async () => {
    const profile = get().profile;
    if (!profile) return;
    try {
      const workspaces = await loadMyWorkspaces(profile);
      const currentWorkspace = workspaces.find(w => w.id === profile.currentWorkspaceId) || workspaces[0] || null;
      set({ workspaces, currentWorkspace });
    } catch (e) { console.error('[ws] refresh failed', e); }
  },

  switchTo: async (wsId) => {
    const user = auth.currentUser;
    if (!user) return;
    const ws = get().workspaces.find(w => w.id === wsId);
    if (!ws) return;
    await setActiveWorkspace(user.uid, wsId);
    // Update local profile
    set((s) => ({
      profile: s.profile ? { ...s.profile, currentWorkspaceId: wsId } : null,
      currentWorkspace: ws
    }));
    // Reload data for the new workspace
    await useData.getState().bootForUser(user.uid);
  },

  createNew: async (name, emoji) => {
    const user = auth.currentUser;
    if (!user) return;
    set({ loading: true });
    try {
      const ws = await createWorkspace(user, name, emoji || '🏢');
      set((s) => ({
        workspaces: [...s.workspaces, ws],
        currentWorkspace: ws,
        profile: s.profile ? { ...s.profile, workspaceIds: [...(s.profile.workspaceIds || []), ws.id], currentWorkspaceId: ws.id } : null,
        loading: false
      }));
      // Boot data for the new workspace
      await useData.getState().bootForUser(user.uid);
    } catch (e) {
      console.error('[ws] create failed', e);
      set({ loading: false });
    }
  },

  rename: async (wsId, name, emoji, color) => {
    await renameWorkspace(wsId, name, emoji, color);
    const ws = await loadWorkspace(wsId);
    if (!ws) return;
    set((s) => ({
      workspaces: s.workspaces.map(w => w.id === wsId ? ws : w),
      currentWorkspace: s.currentWorkspace?.id === wsId ? ws : s.currentWorkspace
    }));
  },

  joinByCode: async (wsId, code) => {
    const user = auth.currentUser;
    if (!user) return;
    set({ loading: true });
    try {
      const ws = await acceptInvite(user, wsId, code);
      set((s) => ({
        workspaces: s.workspaces.some(w => w.id === ws.id) ? s.workspaces.map(w => w.id === ws.id ? ws : w) : [...s.workspaces, ws],
        currentWorkspace: ws,
        profile: s.profile ? { ...s.profile, workspaceIds: Array.from(new Set([...(s.profile.workspaceIds || []), ws.id])), currentWorkspaceId: ws.id } : null,
        loading: false
      }));
      await useData.getState().bootForUser(user.uid);
    } catch (e: any) {
      set({ loading: false });
      throw e;
    }
  },

  invite: async (role = 'member', email) => {
    const ws = get().currentWorkspace;
    if (!ws) throw new Error('Sem workspace ativo');
    const code = await createInvite(ws.id, role, email);
    // Refresh ws to include the new invite
    const updated = await loadWorkspace(ws.id);
    if (updated) {
      set((s) => ({
        workspaces: s.workspaces.map(w => w.id === ws.id ? updated : w),
        currentWorkspace: updated
      }));
    }
    return code;
  },

  removeUser: async (uid) => {
    const ws = get().currentWorkspace;
    if (!ws) return;
    await removeMember(ws.id, uid);
    const updated = await loadWorkspace(ws.id);
    if (updated) {
      set((s) => ({
        workspaces: s.workspaces.map(w => w.id === ws.id ? updated : w),
        currentWorkspace: updated
      }));
    }
  },

  changeRole: async (uid, role) => {
    const ws = get().currentWorkspace;
    if (!ws) return;
    await updateMemberRole(ws.id, uid, role);
    const updated = await loadWorkspace(ws.id);
    if (updated) {
      set((s) => ({
        workspaces: s.workspaces.map(w => w.id === ws.id ? updated : w),
        currentWorkspace: updated
      }));
    }
  },

  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),
  openJoinModal: () => set({ joinModalOpen: true }),
  closeJoinModal: () => set({ joinModalOpen: false }),
  openNewWsModal: () => set({ newWsModalOpen: true }),
  closeNewWsModal: () => set({ newWsModalOpen: false }),

  myRole: () => {
    const user = auth.currentUser;
    const ws = get().currentWorkspace;
    if (!user || !ws) return null;
    return ws.members.find(m => m.uid === user.uid)?.role || null;
  }
}));

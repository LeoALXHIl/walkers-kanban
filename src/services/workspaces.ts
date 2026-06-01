// Workspace management — multi-user team support.
// Each workspace has its own AppData document at workspaces/{wsId}/kanban/main.
// Users have a profile at users/{uid}/profile/main that lists workspaces they belong to.
import { getDoc, setDoc, updateDoc, arrayUnion, type DocumentReference } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { userProfileDoc, workspaceDoc, workspaceDataDoc, userKanbanDoc, db } from './firebase';
import { doc } from 'firebase/firestore';
import { emptyData } from './storage';
import type { Workspace, WorkspaceMember, UserProfile, AppData, WorkspaceRole } from '@/types';

export function genWsId(): string {
  return 'ws_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function genInviteCode(): string {
  return Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
}

function makeMember(user: User, role: WorkspaceRole): WorkspaceMember {
  const m: WorkspaceMember = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
    role,
    joinedAt: Date.now()
  };
  if (user.photoURL) m.photoURL = user.photoURL;
  return m;
}

// Recursively strip undefined values — Firestore doesn't accept them.
function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as any;
  }
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v as any);
    }
    return out;
  }
  return obj;
}

// Ensure the user has a profile document. If missing, creates one.
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = userProfileDoc(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as Partial<UserProfile>;
    // Keep displayName/email synced if changed
    if (data.email !== user.email || data.displayName !== (user.displayName || data.displayName)) {
      const patch: any = { updatedAt: Date.now() };
      if (user.email) patch.email = user.email;
      if (user.displayName) patch.displayName = user.displayName;
      if (user.photoURL) patch.photoURL = user.photoURL;
      await updateDoc(ref, patch);
    }
    return { ...(data as UserProfile), uid: user.uid };
  }
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
    workspaceIds: [],
    currentWorkspaceId: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (user.photoURL) profile.photoURL = user.photoURL;
  await setDoc(ref, stripUndefined(profile));
  return profile;
}

// Create a new workspace owned by the given user.
export async function createWorkspace(user: User, name: string, emoji = '🏢', color = '#7c5cfc'): Promise<Workspace> {
  const wsId = genWsId();
  const member = makeMember(user, 'owner');
  const ws: Workspace = {
    id: wsId,
    name: name.trim() || 'Meu workspace',
    emoji,
    color,
    ownerUid: user.uid,
    memberUids: [user.uid],
    members: [member],
    invites: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await setDoc(workspaceDoc(wsId), stripUndefined(ws));
  // Seed empty AppData
  await setDoc(workspaceDataDoc(wsId), stripUndefined(emptyData()));
  // Add to user profile
  await updateDoc(userProfileDoc(user.uid), {
    workspaceIds: arrayUnion(wsId),
    currentWorkspaceId: wsId,
    updatedAt: Date.now()
  });
  return ws;
}

// Migrate legacy data: copy users/{uid}/kanban/main → workspaces/{newWsId}/kanban/main
export async function migrateLegacyData(user: User): Promise<Workspace | null> {
  const legacyRef = userKanbanDoc(user.uid);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists()) return null;
  const legacyData = legacySnap.data() as AppData;
  // Create workspace
  const ws = await createWorkspace(user, 'Pessoal', '👤', '#7c5cfc');
  // Copy data — strip undefined to keep Firestore happy
  await setDoc(workspaceDataDoc(ws.id), stripUndefined(legacyData));
  return ws;
}

// Load workspace by id
export async function loadWorkspace(wsId: string): Promise<Workspace | null> {
  const snap = await getDoc(workspaceDoc(wsId));
  if (!snap.exists()) return null;
  return snap.data() as Workspace;
}

// Load all workspaces user belongs to
export async function loadMyWorkspaces(profile: UserProfile): Promise<Workspace[]> {
  if (!profile.workspaceIds?.length) return [];
  const promises = profile.workspaceIds.map(loadWorkspace);
  const results = await Promise.all(promises);
  return results.filter((w): w is Workspace => w !== null);
}

// Switch active workspace
export async function setActiveWorkspace(uid: string, wsId: string): Promise<void> {
  await updateDoc(userProfileDoc(uid), {
    currentWorkspaceId: wsId,
    updatedAt: Date.now()
  });
}

// Create an invite code
export async function createInvite(wsId: string, role: WorkspaceRole = 'member', email?: string): Promise<string> {
  const ws = await loadWorkspace(wsId);
  if (!ws) throw new Error('Workspace não encontrado');
  const code = genInviteCode();
  const invite = {
    code, email, role,
    createdAt: Date.now(),
    expiresAt: Date.now() + 14 * 86400000, // 14 days
    uses: 0,
    maxUses: 10
  };
  const updated = [...(ws.invites || []), invite];
  await updateDoc(workspaceDoc(wsId), { invites: updated, updatedAt: Date.now() });
  return code;
}

// Accept invite — adds user to workspace as the role specified
export async function acceptInvite(user: User, wsId: string, code: string): Promise<Workspace> {
  const ws = await loadWorkspace(wsId);
  if (!ws) throw new Error('Workspace não encontrado');
  const invite = (ws.invites || []).find(i => i.code === code);
  if (!invite) throw new Error('Convite inválido');
  if (invite.expiresAt && invite.expiresAt < Date.now()) throw new Error('Convite expirado');
  if (invite.email && invite.email.toLowerCase() !== (user.email || '').toLowerCase()) throw new Error('Este convite é pra outro email');
  if (invite.maxUses && invite.uses >= invite.maxUses) throw new Error('Convite já usado o máximo de vezes');
  if (ws.memberUids.includes(user.uid)) {
    // Already a member — just switch active
    await setActiveWorkspace(user.uid, wsId);
    return ws;
  }
  const newMember = makeMember(user, invite.role);
  const updatedInvites = (ws.invites || []).map(i => i.code === code ? { ...i, uses: i.uses + 1 } : i);
  await updateDoc(workspaceDoc(wsId), {
    memberUids: arrayUnion(user.uid),
    members: [...ws.members, newMember],
    invites: updatedInvites,
    updatedAt: Date.now()
  });
  // Add to user's profile
  await updateDoc(userProfileDoc(user.uid), {
    workspaceIds: arrayUnion(wsId),
    currentWorkspaceId: wsId,
    updatedAt: Date.now()
  });
  return { ...ws, members: [...ws.members, newMember], memberUids: [...ws.memberUids, user.uid] };
}

// Remove a member from a workspace (admin only — caller validates)
export async function removeMember(wsId: string, uid: string): Promise<void> {
  const ws = await loadWorkspace(wsId);
  if (!ws) return;
  if (ws.ownerUid === uid) throw new Error('Owner não pode ser removido');
  const newMembers = ws.members.filter(m => m.uid !== uid);
  const newUids = ws.memberUids.filter(u => u !== uid);
  await updateDoc(workspaceDoc(wsId), {
    members: newMembers,
    memberUids: newUids,
    updatedAt: Date.now()
  });
  // Also remove from user's profile list (best-effort)
  try {
    const profileRef = userProfileDoc(uid);
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const p = snap.data() as UserProfile;
      const newList = (p.workspaceIds || []).filter(id => id !== wsId);
      const newCurrent = p.currentWorkspaceId === wsId ? (newList[0] || '') : p.currentWorkspaceId;
      await updateDoc(profileRef, { workspaceIds: newList, currentWorkspaceId: newCurrent, updatedAt: Date.now() });
    }
  } catch {}
}

export async function updateMemberRole(wsId: string, uid: string, role: WorkspaceRole): Promise<void> {
  const ws = await loadWorkspace(wsId);
  if (!ws) return;
  if (ws.ownerUid === uid) return; // owner role is fixed
  const newMembers = ws.members.map(m => m.uid === uid ? { ...m, role } : m);
  await updateDoc(workspaceDoc(wsId), { members: newMembers, updatedAt: Date.now() });
}

export async function renameWorkspace(wsId: string, name: string, emoji?: string, color?: string): Promise<void> {
  const patch: any = { updatedAt: Date.now() };
  if (name !== undefined) patch.name = name.trim();
  if (emoji !== undefined) patch.emoji = emoji;
  if (color !== undefined) patch.color = color;
  await updateDoc(workspaceDoc(wsId), patch);
}

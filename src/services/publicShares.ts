// Public client portal — shares cards with clients via unique slug URLs.
// Docs at Firestore: publicShares/{slug} (read public, write only by owner)
// Comments at: publicShares/{slug}/comments/{id} (anyone with slug can write)
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, onSnapshot, query, orderBy, type Unsubscribe } from 'firebase/firestore';
import type { PublicShare, PublicShareComment, PublicShareField, PublicShareBranding, PublicShareApproval, PublicShareSnapshot, PublicShareCardSnap, Card, Column } from '@/types';

export const DEFAULT_FIELDS: PublicShareField[] = ['progress', 'cards', 'subtasks', 'meetings', 'due'];

// Base pública do portal (Firebase Hosting). Usa hash-routing (#/c/slug) pra
// funcionar tanto no Electron quanto hospedado na web sem servidor de rotas.
// Base pública do portal (site standalone hospedado no Vercel).
export const PORTAL_BASE = 'https://walkers-kamban.vercel.app';
export function portalUrl(slug: string, token?: string): string {
  return `${PORTAL_BASE}/#/c/${slug}${token ? `?t=${token}` : ''}`;
}

// Token aleatório pra porta extra na URL (?t=).
export function genToken(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
}

export function genSlug(displayName: string): string {
  // Slug bonito: nome-do-cliente-XXXX (4 chars random)
  const base = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'cliente';
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${base}-${rnd}`;
}

// SHA-256 simples pra senha (não criptografia robusta, só evita o cliente ver no source)
export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}

function shareDoc(slug: string) {
  return doc(db, 'publicShares', slug);
}

function commentsCol(slug: string) {
  return collection(db, 'publicShares', slug, 'comments');
}

export interface CreateShareOpts {
  workspaceId: string;
  ownerUid: string;
  clientKey: string;
  clientDisplayName: string;
  cardIdsFilter?: string[];
  visibleFields?: PublicShareField[];
  pin?: string;
  expiresAt?: number;
  branding?: PublicShareBranding;
  allowComments?: boolean;
  allowApprovals?: boolean;
  snapshot?: PublicShareSnapshot;
}

// Monta o snapshot público dos cards respeitando os campos visíveis escolhidos.
export function buildSnapshot(cards: Card[], cols: Column[], fields: PublicShareField[], cardIdsFilter?: string[]): PublicShareSnapshot {
  const lastColId = cols.length ? cols[cols.length - 1].id : null;
  const colName = (id: string) => cols.find(c => c.id === id)?.name || '';
  const showSub = fields.includes('subtasks');
  const showDesc = fields.includes('description');
  const showPlat = fields.includes('plat');
  const allow = cardIdsFilter && cardIdsFilter.length ? new Set(cardIdsFilter) : null;
  return {
    updatedAt: Date.now(),
    cards: cards.filter(c => !c.archived && (!allow || allow.has(c.id))).map(c => {
      const subs = c.subtasks || [];
      const snap: PublicShareCardSnap = {
        id: c.id,
        name: c.name,
        status: colName(c.cid),
        done: c.cid === lastColId,
        prio: c.prio,
        due: c.due ?? null,
        subDone: subs.filter(s => s.status === 'done' || s.done).length,
        subTotal: subs.length
      };
      if (showSub) snap.subtasks = subs.map(s => ({ text: s.text, done: s.status === 'done' || s.done }));
      if (showDesc && c.desc) snap.description = c.desc;
      if (showPlat && c.plat?.length) snap.plat = c.plat;
      return snap;
    })
  };
}

export async function pushSnapshot(slug: string, snapshot: PublicShareSnapshot): Promise<void> {
  try { await updateDoc(shareDoc(slug), { snapshot, updatedAt: Date.now() }); } catch {}
}

export async function createShare(opts: CreateShareOpts): Promise<PublicShare> {
  const slug = genSlug(opts.clientDisplayName);
  const passwordHash = opts.pin ? await hashPin(opts.pin) : undefined;
  const share: PublicShare = {
    slug,
    accessToken: genToken(),
    workspaceId: opts.workspaceId,
    ownerUid: opts.ownerUid,
    clientKey: opts.clientKey,
    clientDisplayName: opts.clientDisplayName,
    cardIdsFilter: opts.cardIdsFilter && opts.cardIdsFilter.length ? opts.cardIdsFilter : undefined,
    visibleFields: opts.visibleFields || DEFAULT_FIELDS,
    passwordHash,
    expiresAt: opts.expiresAt,
    branding: opts.branding,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    views: 0,
    allowComments: opts.allowComments ?? true,
    allowApprovals: opts.allowApprovals ?? true,
    approvals: [],
    snapshot: opts.snapshot
  };
  await setDoc(shareDoc(slug), share);
  return share;
}

export async function getShare(slug: string): Promise<PublicShare | null> {
  const snap = await getDoc(shareDoc(slug));
  if (!snap.exists()) return null;
  return snap.data() as PublicShare;
}

export function subscribeShare(slug: string, cb: (share: PublicShare | null) => void): Unsubscribe {
  return onSnapshot(shareDoc(slug), (snap) => {
    cb(snap.exists() ? (snap.data() as PublicShare) : null);
  });
}

export async function updateShare(slug: string, patch: Partial<PublicShare>): Promise<void> {
  await updateDoc(shareDoc(slug), { ...patch, updatedAt: Date.now() });
}

export async function revokeShare(slug: string): Promise<void> {
  await deleteDoc(shareDoc(slug));
}

export async function recordView(slug: string): Promise<void> {
  try {
    const ref = shareDoc(slug);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as PublicShare;
    await updateDoc(ref, {
      views: (data.views || 0) + 1,
      lastViewedAt: Date.now()
    });
  } catch {}
}

export async function addComment(slug: string, text: string, author?: string, cardId?: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(commentsCol(slug), {
    text: trimmed,
    author: author?.trim() || 'Cliente',
    cardId: cardId || null,
    ts: Date.now()
  });
}

export async function getComments(slug: string): Promise<PublicShareComment[]> {
  const snap = await getDocs(query(commentsCol(slug), orderBy('ts', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export function subscribeComments(slug: string, cb: (comments: PublicShareComment[]) => void): Unsubscribe {
  return onSnapshot(query(commentsCol(slug), orderBy('ts', 'desc')), (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  });
}

export async function recordApproval(slug: string, cardId: string, approvedBy?: string, note?: string): Promise<void> {
  const ref = shareDoc(slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as PublicShare;
  const existing = (data.approvals || []).filter(a => a.cardId !== cardId);
  const approval: PublicShareApproval = {
    cardId,
    approvedAt: Date.now(),
    approvedBy: approvedBy || 'Cliente',
    note
  };
  await updateDoc(ref, {
    approvals: [...existing, approval],
    updatedAt: Date.now()
  });
}

// Lista todos os shares criados por um owner (pra UI no app desktop)
export async function listSharesByOwner(_ownerUid: string): Promise<PublicShare[]> {
  // Firestore não tem query direta sem colocar índice — vamos buscar tudo + filtrar
  // Como volume é baixo, ok. Em produção real precisaria de índice.
  const snap = await getDocs(collection(db, 'publicShares'));
  return snap.docs
    .map(d => d.data() as PublicShare)
    .filter(s => s.ownerUid === _ownerUid && !s.revoked);
}

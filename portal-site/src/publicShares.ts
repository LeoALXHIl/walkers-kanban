// Acesso de LEITURA ao portal (+ comentários/aprovações do cliente).
import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, type Unsubscribe } from 'firebase/firestore';
import type { PublicShare, PublicShareComment } from './types';

function shareDoc(slug: string) { return doc(db, 'publicShares', slug); }
function commentsCol(slug: string) { return collection(db, 'publicShares', slug, 'comments'); }

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}

export function subscribeShare(slug: string, cb: (s: PublicShare | null) => void): Unsubscribe {
  return onSnapshot(shareDoc(slug), (snap) => cb(snap.exists() ? (snap.data() as PublicShare) : null));
}

export function subscribeComments(slug: string, cb: (c: PublicShareComment[]) => void): Unsubscribe {
  return onSnapshot(query(commentsCol(slug), orderBy('ts', 'desc')), (snap) =>
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
  );
}

export async function recordView(slug: string): Promise<void> {
  try {
    const ref = shareDoc(slug);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as PublicShare;
    await updateDoc(ref, { views: (data.views || 0) + 1, lastViewedAt: Date.now() });
  } catch {}
}

export async function addComment(slug: string, text: string, author?: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  await addDoc(commentsCol(slug), { text: t, author: author?.trim() || 'Cliente', cardId: null, ts: Date.now() });
}

export async function recordApproval(slug: string, cardId: string, approvedBy?: string, note?: string): Promise<void> {
  const ref = shareDoc(slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as PublicShare;
  const existing = (data.approvals || []).filter(a => a.cardId !== cardId);
  await updateDoc(ref, {
    approvals: [...existing, { cardId, approvedAt: Date.now(), approvedBy: approvedBy || 'Cliente', note }],
    updatedAt: Date.now()
  });
}

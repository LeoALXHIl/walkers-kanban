// Caminho A — envio de email de atribuição PELO APP (Gmail do usuário logado).
// Dispara no cliente que faz a atribuição, na hora. Sem backend.
//
// ⚠️ Não use junto com a Cloud Function (Caminho B) — senão a pessoa
// recebe 2 emails. Controle pelo toggle `walkers.assignEmail.enabled`.
import { useAuth } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import { sendGmailMessage } from './google';
import { toast } from './toast';

const ENABLED_KEY = 'walkers.assignEmail.enabled';

export function assignEmailEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
export function setAssignEmailEnabled(on: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch {}
}

function norm(s: string | null | undefined): string {
  return (s || '').toString().trim().toLowerCase();
}

function emailHtml(opts: { wsName: string; intro: string; cardName: string; subText?: string; due?: string | null }): string {
  const { wsName, intro, cardName, subText, due } = opts;
  const subLine = subText
    ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;">✓ Subtarefa: <strong>${subText}</strong></p>`
    : '';
  const dueLine = due
    ? `<p style="margin:0 0 6px;color:#b45309;font-size:13px;">📅 Vencimento: <strong>${due}</strong></p>`
    : '';
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#7c5cfc,#ec4899);padding:20px 24px;border-radius:14px 14px 0 0;">
      <div style="color:#fff;font-size:18px;font-weight:700;">📌 Nova tarefa pra você</div>
      <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:2px;">${wsName}</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;">
      <p style="margin:0 0 12px;color:#111827;font-size:15px;">${intro}</p>
      <p style="margin:0 0 6px;color:#374151;font-size:14px;">🗂️ Card: <strong>${cardName}</strong></p>
      ${subLine}
      ${dueLine}
      <p style="margin:18px 0 0;color:#6b7280;font-size:12px;">Abra o Walkers Kanban pra ver os detalhes.</p>
    </div>
  </div>`;
}

export interface AssignEmailOpts {
  assignee: string | null | undefined;   // novo responsável
  prevAssignee?: string | null;          // responsável anterior (pra não reenviar)
  cardName: string;
  subText?: string;
  due?: string | null;
}

// Envia o email se: feature ligada, é um responsável NOVO, não sou eu mesmo,
// e consigo resolver o email do membro. Falhas são silenciosas (toast só em casos úteis).
export async function maybeEmailAssignee(opts: AssignEmailOpts): Promise<void> {
  if (!assignEmailEnabled()) return;
  const assignee = (opts.assignee || '').trim();
  if (!assignee) return;
  if (norm(assignee) === norm(opts.prevAssignee)) return; // não mudou

  const user = useAuth.getState().user;
  const selfNames = [user?.displayName, user?.email, user?.email?.split('@')[0]].map(norm).filter(Boolean);
  if (selfNames.includes(norm(assignee))) return; // não emailar a si mesmo

  const ws = useWorkspace.getState().currentWorkspace;
  const members = ws?.members || [];
  const m = members.find(mb => norm(mb.displayName) === norm(assignee) || norm(mb.email) === norm(assignee));
  const to = m?.email || (assignee.includes('@') ? assignee : null);
  if (!to) return; // sem email conhecido pra esse responsável

  const subject = opts.subText ? `📌 Nova subtarefa: ${opts.subText}` : `📌 Novo card atribuído: ${opts.cardName}`;
  const intro = opts.subText
    ? `Você foi atribuído a uma subtarefa no card <strong>"${opts.cardName}"</strong>.`
    : `Você foi atribuído ao card <strong>"${opts.cardName}"</strong>.`;
  const html = emailHtml({ wsName: ws?.name || 'Walkers Kanban', intro, cardName: opts.cardName, subText: opts.subText, due: opts.due });

  try {
    await sendGmailMessage(to, subject, html);
    toast.success(`Email enviado pra ${m?.displayName || to}`, { icon: '📧', durationMs: 2500 });
  } catch (e: any) {
    if (e?.reason === 'forbidden' || e?.reason === 'no-token' || e?.reason === 'expired') {
      toast.error('Pra enviar email, reconecte o Google em Integrações (permissão de envio).', { durationMs: 4500 });
    } else {
      console.warn('[walkers] assign email failed', e);
    }
  }
}

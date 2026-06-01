import { useEffect, useRef, useState } from 'react';
import { subscribeShare, subscribeComments, recordView, addComment, recordApproval, verifyPin } from './publicShares';
import type { PublicShare, PublicShareComment, PublicShareCardSnap } from './types';

function fmtDate(d?: string | null): string {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); } catch { return d; }
}
function fmtTs(ts: number): string {
  try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export function PublicPortal({ slug, token = '' }: { slug: string; token?: string }) {
  const [share, setShare] = useState<PublicShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PublicShareComment[]>([]);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const viewedRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeShare(slug, (s) => { setShare(s); setLoading(false); });
    const unsubC = subscribeComments(slug, setComments);
    if (sessionStorage.getItem('portal.unlocked.' + slug) === '1') setUnlocked(true);
    return () => { unsub(); unsubC(); };
  }, [slug]);

  const accent = share?.branding?.primaryColor || '#7c5cfc';
  const needsPin = !!share?.passwordHash && !unlocked;
  const expired = share?.expiresAt != null && share.expiresAt < Date.now();

  useEffect(() => {
    if (share && !needsPin && !expired && !viewedRef.current) {
      viewedRef.current = true;
      recordView(slug);
    }
  }, [share, needsPin, expired, slug]);

  if (loading) return <Shell accent={accent}><div style={center}>Carregando…</div></Shell>;
  if (!share || share.revoked) return <Shell accent={accent}><div style={center}>🔒 Este link não está mais disponível.</div></Shell>;
  if (share.accessToken && share.accessToken !== token) return <Shell accent={accent}><div style={center}>🔒 Link inválido ou incompleto. Confira o endereço que você recebeu.</div></Shell>;
  if (expired) return <Shell accent={accent}><div style={center}>⏰ Este link expirou. Peça um novo ao seu contato.</div></Shell>;

  if (needsPin) {
    const submitPin = async () => {
      if (await verifyPin(pinInput, share.passwordHash!)) {
        sessionStorage.setItem('portal.unlocked.' + slug, '1');
        setUnlocked(true);
      } else { setPinError('PIN incorreto'); }
    };
    return (
      <Shell accent={accent}>
        <div style={{ ...center, flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 32 }}>🔒</div>
          <div style={{ fontWeight: 600 }}>Acesso protegido</div>
          <div style={{ color: '#667', fontSize: 13 }}>Digite o PIN que você recebeu.</div>
          <input
            type="password" inputMode="numeric" value={pinInput} autoFocus
            onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submitPin(); }}
            style={{ padding: '10px 14px', fontSize: 18, letterSpacing: 4, textAlign: 'center', border: '1px solid #d4d7e0', borderRadius: 10, width: 160 }}
          />
          {pinError && <div style={{ color: '#dc2626', fontSize: 12 }}>{pinError}</div>}
          <button onClick={submitPin} style={{ ...btn(accent), width: 160 }}>Entrar</button>
        </div>
      </Shell>
    );
  }

  const cards: PublicShareCardSnap[] = share.snapshot?.cards || [];
  const fields = share.visibleFields || [];
  const has = (f: string) => fields.includes(f as any);
  const total = cards.length;
  const doneCount = cards.filter(c => c.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const approvedSet = new Set((share.approvals || []).map(a => a.cardId));

  const approve = async (cardId: string) => {
    const name = window.prompt('Seu nome (pra registrar a aprovação):') || 'Cliente';
    await recordApproval(slug, cardId, name);
  };

  return (
    <Shell accent={accent}>
      <div style={{ background: accent, color: '#fff', padding: '28px 24px', borderRadius: '0 0 20px 20px' }}>
        {share.branding?.logoUrl && <img src={share.branding.logoUrl} alt="" style={{ height: 40, marginBottom: 12 }} />}
        <div style={{ fontSize: 13, opacity: .85 }}>Status da implementação</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{share.clientDisplayName}</div>
        {share.branding?.welcomeMessage && (
          <div style={{ fontSize: 14, marginTop: 8, opacity: .95, lineHeight: 1.5 }}>{share.branding.welcomeMessage}</div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>
        {has('progress') && total > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <strong>Progresso geral</strong>
              <span style={{ fontSize: 22, fontWeight: 700, color: accent }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: '#eceef4', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: accent, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#667', marginTop: 6 }}>{doneCount} de {total} etapas concluídas</div>
          </div>
        )}

        {has('cards') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {cards.length === 0 && <div style={{ ...card, color: '#667', textAlign: 'center' }}>Nenhuma etapa cadastrada ainda.</div>}
            {cards.map(c => {
              const approved = approvedSet.has(c.id);
              return (
                <div key={c.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.done ? '#22c55e' : accent, flexShrink: 0 }} />
                    <strong style={{ flex: 1, textDecoration: c.done ? 'line-through' : 'none', color: c.done ? '#8890a6' : '#1a1c24' }}>{c.name}</strong>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: c.done ? 'rgba(34,197,94,.14)' : '#eef0f5', color: c.done ? '#16a34a' : '#555' }}>{c.status}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#667' }}>
                    {has('due') && c.due && <span>⏰ {fmtDate(c.due)}</span>}
                    {c.subTotal > 0 && <span>✅ {c.subDone}/{c.subTotal}</span>}
                    {has('plat') && c.plat?.length ? <span>📱 {c.plat.join(', ')}</span> : null}
                  </div>

                  {has('description') && c.description && (
                    <div style={{ fontSize: 13, color: '#445', marginTop: 8, whiteSpace: 'pre-wrap' }}>{c.description}</div>
                  )}

                  {has('subtasks') && c.subtasks && c.subtasks.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {c.subtasks.map((s, i) => (
                        <div key={i} style={{ fontSize: 12, color: s.done ? '#8890a6' : '#445', display: 'flex', gap: 6 }}>
                          <span style={{ color: s.done ? '#22c55e' : '#c4c8d4' }}>{s.done ? '✓' : '○'}</span>
                          <span style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {share.allowApprovals && (
                    approved
                      ? <div style={{ marginTop: 10, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Você aprovou esta etapa</div>
                      : <button onClick={() => approve(c.id)} style={{ ...btnGhost(accent), marginTop: 10 }}>Aprovar esta etapa</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {share.allowComments && <CommentsBlock slug={slug} accent={accent} comments={comments} />}

        {(share.branding?.contactPhone || share.branding?.contactEmail) && (
          <div style={{ ...card, marginTop: 14, fontSize: 13, color: '#445' }}>
            <strong>Precisa falar com a gente?</strong>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {share.branding?.contactPhone && <span>📞 {share.branding.contactPhone}</span>}
              {share.branding?.contactEmail && <span>✉️ {share.branding.contactEmail}</span>}
            </div>
          </div>
        )}

        {share.snapshot?.updatedAt && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#99a', marginTop: 18 }}>
            Atualizado em {fmtTs(share.snapshot.updatedAt)}
          </div>
        )}
        {(share.branding?.showWalkersBrand ?? true) && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#b6b9c8', marginTop: 10 }}>
            Powered by <strong>Walkers Kanban</strong>
          </div>
        )}
      </div>
    </Shell>
  );
}

function CommentsBlock({ slug, accent, comments }: { slug: string; accent: string; comments: PublicShareComment[] }) {
  const [name, setName] = useState(() => localStorage.getItem('portal.name') || '');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      if (name.trim()) localStorage.setItem('portal.name', name.trim());
      await addComment(slug, text, name.trim() || 'Cliente');
      setText('');
    } finally { setSending(false); }
  };

  return (
    <div style={{ ...card, marginTop: 14 }}>
      <strong>💬 Comentários</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        <input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} style={inp} />
        <textarea placeholder="Escreva uma mensagem, dúvida ou feedback…" value={text} rows={3} onChange={(e) => setText(e.target.value)} style={{ ...inp, resize: 'vertical' }} />
        <button onClick={send} disabled={sending || !text.trim()} style={{ ...btn(accent), alignSelf: 'flex-start', opacity: sending || !text.trim() ? .6 : 1 }}>
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
      {comments.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.map(c => (
            <div key={c.id} style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 10 }}>
              <div style={{ fontSize: 13, color: '#1a1c24' }}>{c.text}</div>
              <div style={{ fontSize: 11, color: '#99a', marginTop: 2 }}>{c.author || 'Cliente'} · {fmtTs(c.ts)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ children, accent }: { children: any; accent: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#f4f5f9', fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif', color: '#1a1c24', ['--pa' as any]: accent }}>
      {children}
    </div>
  );
}

const center: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#556', fontSize: 14, padding: 20, textAlign: 'center' };
const card: any = { background: '#fff', border: '1px solid #e7e9f0', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' };
const inp: any = { padding: '9px 12px', fontSize: 14, border: '1px solid #d4d7e0', borderRadius: 8, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
function btn(accent: string): any { return { background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }; }
function btnGhost(accent: string): any { return { background: 'transparent', color: accent, border: `1px solid ${accent}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }; }

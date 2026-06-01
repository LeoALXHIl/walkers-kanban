// Component dentro do ClientDetailModal — gerencia portal público do cliente.
import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import { useData } from '@/store/data';
import { createShare, updateShare, revokeShare, getShare, subscribeShare, subscribeComments, hashPin, portalUrl, genToken, buildSnapshot, pushSnapshot, type CreateShareOpts } from '@/services/publicShares';
import { toast } from '@/services/toast';
import { fmtTime } from '@/services/storage';
import type { PublicShare, PublicShareField, PublicShareComment } from '@/types';

const FIELD_OPTIONS: Array<{ v: PublicShareField; label: string; desc: string }> = [
  { v: 'progress',    label: '📊 Barra de progresso geral',   desc: 'Quantos % das etapas estão concluídas' },
  { v: 'cards',       label: '📋 Lista de etapas/cards',       desc: 'Nome + status de cada implementação' },
  { v: 'subtasks',    label: '✅ Subtarefas',                  desc: 'Detalhes do que tá feito dentro de cada card' },
  { v: 'description', label: '📝 Descrições',                  desc: 'Texto explicativo de cada etapa' },
  { v: 'meetings',    label: '📅 Próxima reunião',             desc: 'Data + hora + link Meet' },
  { v: 'due',         label: '⏰ Prazos',                       desc: 'Quando cada etapa deve estar pronta' },
  { v: 'plat',        label: '📱 Plataformas',                  desc: 'WhatsApp, Instagram, Messenger' },
  { v: 'comments',    label: '💬 Comentários internos',         desc: 'Cuidado: cliente lê suas notas internas' }
];

interface Props { clientKey: string; clientDisplayName: string; }

export function PortalManager({ clientKey, clientDisplayName }: Props) {
  const user = useAuth(s => s.user);
  const workspaceId = useWorkspace(s => s.currentWorkspace?.id) || '';
  const cards = useData(s => s.data.cards.filter(c => {
    const name = (c.name || '').toLowerCase().split(/[-–—]/)[0].trim();
    return name === clientKey.toLowerCase().trim();
  }));
  const cols = useData(s => s.data.cols);

  const [share, setShare] = useState<PublicShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PublicShareComment[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  // Carrega share existente (lookup by clientKey + ownerUid)
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    // Try local cache from window for the slug
    const cacheKey = `walkers.share.${workspaceId}.${clientKey}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      // Subscribe direto
      const unsub = subscribeShare(cached, (s) => {
        setShare(s);
        setLoading(false);
      });
      const unsubC = subscribeComments(cached, setComments);
      return () => { unsub(); unsubC(); };
    } else {
      setLoading(false);
    }
  }, [clientKey, workspaceId, user]);

  // Mantém o snapshot público atualizado enquanto a aba está aberta (e logo após criar/editar).
  useEffect(() => {
    if (!share) return;
    const snap = buildSnapshot(cards, cols, share.visibleFields);
    const t = setTimeout(() => pushSnapshot(share.slug, snap), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share?.slug, cards, cols, share?.visibleFields]);

  // Backfill: shares criados antes do token ganham um agora.
  useEffect(() => {
    if (share && !share.accessToken) updateShare(share.slug, { accessToken: genToken() } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share?.slug, share?.accessToken]);

  if (loading) return <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>Carregando portal…</div>;

  if (creating || editing) {
    return <ShareForm
      existing={editing ? share : null}
      clientKey={clientKey}
      clientDisplayName={clientDisplayName}
      workspaceId={workspaceId}
      ownerUid={user?.uid || ''}
      onClose={() => { setCreating(false); setEditing(false); }}
      onSaved={(s) => {
        localStorage.setItem(`walkers.share.${workspaceId}.${clientKey}`, s.slug);
        setShare(s);
      }}
    />;
  }

  if (!share) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🌐</div>
        <h3 style={{ margin: 0, fontSize: 14 }}>Sem portal público ativo</h3>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
          Gera um link único que o cliente abre no navegador (sem login) e acompanha o status da implementação em tempo real.
          Você controla o que aparece.
        </p>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>🌐 Gerar link público</button>
      </div>
    );
  }

  const url = portalUrl(share.slug, share.accessToken);
  const expired = share.expiresAt && share.expiresAt < Date.now();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!', { icon: '📋' });
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const revoke = async () => {
    if (!confirm(`Revogar acesso? O link ${url} vai parar de funcionar.`)) return;
    await revokeShare(share.slug);
    localStorage.removeItem(`walkers.share.${workspaceId}.${clientKey}`);
    setShare(null);
    toast.success('Acesso revogado', { icon: '🚫' });
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Link box */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--rs)', padding: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>
          Link público do cliente
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <code style={{ flex: 1, padding: '7px 10px', background: 'var(--bg)', borderRadius: 4, fontSize: 11, fontFamily: 'Geist Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {url}
          </code>
          <button className="btn btn-primary" onClick={copyLink} style={{ fontSize: 11, padding: '6px 12px' }}>📋 Copiar</button>
        </div>
        {expired && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,.12)', borderRadius: 4, fontSize: 11, color: 'var(--red)' }}>
            ⚠️ Expirado em {fmtTime(share.expiresAt!)}
          </div>
        )}
        {share.passwordHash && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text3)' }}>🔒 Protegido por PIN</div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <div className="client-stat">
          <div className="client-stat-label">Acessos</div>
          <div className="client-stat-value">{share.views}</div>
          <div className="client-stat-sub">{share.lastViewedAt ? `último ${fmtTime(share.lastViewedAt)}` : 'nunca acessado'}</div>
        </div>
        <div className="client-stat">
          <div className="client-stat-label">Aprovações</div>
          <div className="client-stat-value">{share.approvals?.length || 0}</div>
          <div className="client-stat-sub">cards aprovados</div>
        </div>
        <div className="client-stat">
          <div className="client-stat-label">Comentários</div>
          <div className="client-stat-value">{comments.length}</div>
          <div className="client-stat-sub">do cliente</div>
        </div>
      </div>

      {/* Comments from client */}
      {comments.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, fontWeight: 600 }}>
            💬 Comentários do cliente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {comments.slice(0, 10).map(c => (
              <div key={c.id} style={{ background: 'var(--bg3)', padding: '7px 10px', borderRadius: 4, borderLeft: '3px solid var(--accent)' }}>
                <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>{c.text}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)' }}>{c.author || 'Cliente'} · {fmtTime(c.ts)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approvals */}
      {(share.approvals || []).length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, fontWeight: 600 }}>
            ✅ Aprovações
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(share.approvals || []).map((a, i) => {
              const card = useData.getState().data.cards.find(c => c.id === a.cardId);
              return (
                <div key={i} style={{ fontSize: 11, padding: '5px 9px', background: 'rgba(34,197,94,.1)', borderRadius: 4 }}>
                  ✅ <strong>{card?.name || a.cardId}</strong> aprovado por {a.approvedBy || 'Cliente'} em {fmtTime(a.approvedAt)}
                  {a.note && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>"{a.note}"</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost" onClick={() => { window.location.hash = `#/c/${share.slug}${share.accessToken ? `?t=${share.accessToken}` : ''}`; window.location.reload(); }} title="Ver como o cliente vê">👁 Pré-visualizar</button>
        <button className="btn btn-ghost" onClick={() => setEditing(true)} style={{ flex: 1 }}>⚙️ Configurar</button>
        <button className="btn btn-danger" onClick={revoke}>🚫 Revogar</button>
      </div>
    </div>
  );
}

function ShareForm({ existing, clientKey, clientDisplayName, workspaceId, ownerUid, onClose, onSaved }: {
  existing: PublicShare | null;
  clientKey: string;
  clientDisplayName: string;
  workspaceId: string;
  ownerUid: string;
  onClose: () => void;
  onSaved: (s: PublicShare) => void;
}) {
  const [fields, setFields] = useState<PublicShareField[]>(existing?.visibleFields || DEFAULT_FIELDS);
  const [pin, setPin] = useState('');
  const [enablePin, setEnablePin] = useState(!!existing?.passwordHash);
  const [expires, setExpires] = useState<'never' | '30' | '90' | 'custom'>(
    existing?.expiresAt ? 'custom' : 'never'
  );
  const [customDate, setCustomDate] = useState(
    existing?.expiresAt ? new Date(existing.expiresAt).toISOString().slice(0, 10) : ''
  );
  const [allowComments, setAllowComments] = useState(existing?.allowComments ?? true);
  const [allowApprovals, setAllowApprovals] = useState(existing?.allowApprovals ?? true);
  const [welcomeMessage, setWelcomeMessage] = useState(existing?.branding?.welcomeMessage || '');
  const [contactPhone, setContactPhone] = useState(existing?.branding?.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(existing?.branding?.contactEmail || '');
  const [primaryColor, setPrimaryColor] = useState(existing?.branding?.primaryColor || '#7c5cfc');
  const [logoUrl, setLogoUrl] = useState(existing?.branding?.logoUrl || '');
  const [brandName, setBrandName] = useState(existing?.branding?.brandName || '');
  const [showBrand, setShowBrand] = useState(existing?.branding?.showWalkersBrand ?? true);
  const [submitting, setSubmitting] = useState(false);

  const toggleField = (f: PublicShareField) => {
    setFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const submit = async () => {
    if (fields.length === 0) { toast.error('Escolha pelo menos 1 campo pra exibir'); return; }
    if (enablePin && pin.length < 4) { toast.error('PIN precisa ter pelo menos 4 dígitos'); return; }

    let expiresAt: number | undefined;
    if (expires === '30') expiresAt = Date.now() + 30 * 86400000;
    else if (expires === '90') expiresAt = Date.now() + 90 * 86400000;
    else if (expires === 'custom' && customDate) expiresAt = new Date(customDate + 'T23:59:59').getTime();

    setSubmitting(true);
    try {
      const opts: CreateShareOpts = {
        workspaceId, ownerUid, clientKey, clientDisplayName,
        visibleFields: fields,
        pin: enablePin ? pin : undefined,
        expiresAt,
        allowComments,
        allowApprovals,
        branding: {
          primaryColor,
          logoUrl: logoUrl.trim() || undefined,
          brandName: brandName.trim() || undefined,
          showWalkersBrand: showBrand,
          welcomeMessage: welcomeMessage.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined
        }
      };
      if (existing) {
        // PIN: novo se digitou, mantém o atual se ligado sem digitar, null pra remover
        let passwordHash: string | null | undefined;
        if (enablePin) passwordHash = pin ? await hashPin(pin) : existing.passwordHash;
        else passwordHash = null; // null limpa o campo no Firestore (undefined seria ignorado)
        await updateShare(existing.slug, {
          visibleFields: fields,
          passwordHash: passwordHash as any,
          expiresAt: expiresAt ?? null as any,
          allowComments,
          allowApprovals,
          branding: opts.branding
        });
        const updated = await getShare(existing.slug);
        if (updated) onSaved(updated);
        toast.success('Portal atualizado');
      } else {
        const share = await createShare(opts);
        onSaved(share);
        toast.success('Portal criado!', { icon: '🌐' });
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 16, maxHeight: 480, overflowY: 'auto' }}>
      <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>{existing ? '⚙️ Configurar portal' : '🌐 Gerar link público'}</h3>

      <div className="frow">
        <label className="flabel">Campos visíveis pro cliente</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {FIELD_OPTIONS.map(opt => (
            <label key={opt.v} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 6, cursor: 'pointer', borderRadius: 4, background: fields.includes(opt.v) ? 'var(--bg3)' : 'transparent' }}>
              <input type="checkbox" checked={fields.includes(opt.v)} onChange={() => toggleField(opt.v)} style={{ marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="frow">
        <label className="flabel">🔒 Proteção por PIN</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={enablePin} onChange={(e) => setEnablePin(e.target.checked)} />
          Exigir PIN pra acessar
        </label>
        {enablePin && (
          <input type="text" className="finput" placeholder="4-6 dígitos" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} style={{ marginTop: 6 }} />
        )}
      </div>

      <div className="frow">
        <label className="flabel">⏰ Expiração</label>
        <select className="filter-sel" value={expires} onChange={(e) => setExpires(e.target.value as any)} style={{ width: '100%' }}>
          <option value="never">Nunca expira</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="custom">Data específica…</option>
        </select>
        {expires === 'custom' && (
          <input type="date" className="finput" value={customDate} onChange={(e) => setCustomDate(e.target.value)} style={{ marginTop: 6 }} />
        )}
      </div>

      <div className="frow">
        <label className="flabel">💬 Interatividade</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />
          Permitir cliente deixar comentários
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={allowApprovals} onChange={(e) => setAllowApprovals(e.target.checked)} />
          Permitir aprovação digital de etapas
        </label>
      </div>

      <details style={{ marginTop: 8, marginBottom: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>🎨 Branding (white-label)</summary>
        <div className="frow" style={{ marginTop: 8 }}>
          <label className="flabel">Nome da sua marca</label>
          <input className="finput" placeholder="Ex.: Studio Leo Digital" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Logo (URL da imagem)</label>
          <input className="finput" type="url" placeholder="https://.../logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          {logoUrl.trim() && (
            <img src={logoUrl} alt="" style={{ height: 32, marginTop: 8, borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
        <div className="frow">
          <label className="flabel">Cor primária</label>
          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 60, height: 32, border: 'none', cursor: 'pointer' }} />
        </div>
        <div className="frow">
          <label className="flabel">Mensagem de boas-vindas</label>
          <textarea className="finput" rows={2} placeholder="Bem-vindo ao status da sua implementação!" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Telefone de contato</label>
          <input className="finput" placeholder="(11) 99999-9999" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Email de contato</label>
          <input className="finput" type="email" placeholder="leo@walkers.app" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 4 }}>
          <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} />
          Mostrar "Powered by Walkers" no rodapé
        </label>
      </details>

      <div className="mfoot">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? 'Salvando…' : existing ? 'Salvar mudanças' : '🌐 Gerar link'}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_FIELDS: PublicShareField[] = ['progress', 'cards', 'subtasks', 'meetings', 'due'];

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/store/workspace';
import { useAuth } from '@/store/auth';
import { pickHashColor } from '@/services/colors';
import { toast } from '@/services/toast';
import type { WorkspaceRole } from '@/types';

type Tab = 'members' | 'invites' | 'settings';

const ROLES: Array<{ v: WorkspaceRole; label: string; emoji: string; desc: string }> = [
  { v: 'owner',  label: 'Dono',    emoji: '👑', desc: 'Acesso total + fatura/exclui workspace' },
  { v: 'admin',  label: 'Admin',   emoji: '🛠️', desc: 'Convida, configura, edita tudo' },
  { v: 'member', label: 'Membro',  emoji: '👤', desc: 'Cria e edita cards/clientes' },
  { v: 'viewer', label: 'Viewer',  emoji: '👁',  desc: 'Só leitura — ideal pra cliente acompanhar' }
];

export function WorkspaceModal() {
  const open = useWorkspace(s => s.modalOpen);
  const close = useWorkspace(s => s.closeModal);
  const ws = useWorkspace(s => s.currentWorkspace);
  const myRole = useWorkspace(s => s.myRole);
  const invite = useWorkspace(s => s.invite);
  const removeUser = useWorkspace(s => s.removeUser);
  const changeRole = useWorkspace(s => s.changeRole);
  const rename = useWorkspace(s => s.rename);
  const user = useAuth(s => s.user);

  const [tab, setTab] = useState<Tab>('members');
  const [newCode, setNewCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  useEffect(() => {
    if (!open || !ws) return;
    setTab('members');
    setName(ws.name);
    setEmoji(ws.emoji || '🏢');
    setNewCode(null);
  }, [open, ws?.id]);

  if (!open || !ws) return null;
  const role = myRole();
  const canManage = role === 'owner' || role === 'admin';

  const doInvite = async () => {
    try {
      const code = await invite(inviteRole);
      setNewCode(code);
      toast.success('Convite criado — copie o código abaixo');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar convite');
    }
  };

  const copyInvite = (code: string) => {
    const url = `${ws.id}::${code}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Código copiado'));
  };

  const saveSettings = async () => {
    await rename(ws.id, name.trim() || ws.name, emoji);
    toast.success('Workspace atualizado');
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ws.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {ws.emoji || '🏢'}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{ws.name}</h2>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {ws.members.length} membro{ws.members.length === 1 ? '' : 's'} · {role}
            </div>
          </div>
        </div>

        <div className="client-tabs" style={{ marginTop: 12 }}>
          <button className={`client-tab${tab === 'members' ? ' active' : ''}`} onClick={() => setTab('members')}>Membros ({ws.members.length})</button>
          {canManage && <button className={`client-tab${tab === 'invites' ? ' active' : ''}`} onClick={() => setTab('invites')}>Convites ({(ws.invites || []).length})</button>}
          {canManage && <button className={`client-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>Configurações</button>}
        </div>

        <div style={{ paddingTop: 14 }}>
          {tab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ws.members.map(m => {
                const isMe = m.uid === user?.uid;
                const isOwner = m.uid === ws.ownerUid;
                const roleMeta = ROLES.find(r => r.v === m.role);
                return (
                  <div key={m.uid} className="cf-row">
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: pickHashColor(m.displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                      {m.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {m.displayName}{isMe && <span style={{ color: 'var(--text3)', fontSize: 11 }}> (você)</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{m.email}</div>
                    </div>
                    {canManage && !isOwner ? (
                      <select
                        className="filter-sel"
                        value={m.role}
                        onChange={(e) => changeRole(m.uid, e.target.value as WorkspaceRole)}
                        style={{ fontSize: 11 }}
                      >
                        {ROLES.filter(r => r.v !== 'owner').map(r => <option key={r.v} value={r.v}>{r.emoji} {r.label}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{roleMeta?.emoji} {roleMeta?.label}</span>
                    )}
                    {canManage && !isOwner && !isMe && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => { if (confirm(`Remover ${m.displayName} do workspace?`)) removeUser(m.uid); }}
                      >🗑️</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'invites' && canManage && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                Crie códigos de convite e mande pra quem quiser adicionar ao workspace.
                Validade: 14 dias, até 10 usos cada.
              </p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <select className="filter-sel" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)} style={{ flex: 1 }}>
                  {ROLES.filter(r => r.v !== 'owner').map(r => (
                    <option key={r.v} value={r.v}>{r.emoji} {r.label} — {r.desc}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={doInvite}>Criar convite</button>
              </div>

              {newCode && (
                <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 'var(--rs)', padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>✓ Convite criado!</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg)', borderRadius: 4, fontSize: 11, fontFamily: 'Geist Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ws.id}::{newCode}
                    </code>
                    <button className="btn btn-ghost" onClick={() => copyInvite(newCode)} style={{ fontSize: 11, padding: '5px 10px' }}>📋 Copiar</button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                    Manda esse código pra pessoa. Ela vai em "+ Entrar em workspace" e cola aí.
                  </div>
                </div>
              )}

              {(ws.invites || []).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Convites ativos
                  </div>
                  {(ws.invites || []).map(inv => (
                    <div key={inv.code} className="cf-row" style={{ fontSize: 11 }}>
                      <code style={{ fontFamily: 'Geist Mono, monospace' }}>{inv.code}</code>
                      <span style={{ flex: 1, color: 'var(--text3)' }}>
                        {inv.uses}/{inv.maxUses || '∞'} usos · {ROLES.find(r => r.v === inv.role)?.emoji} {inv.role}
                      </span>
                      <button className="btn btn-ghost" onClick={() => copyInvite(inv.code)} style={{ fontSize: 11, padding: '3px 8px' }}>📋</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'settings' && canManage && (
            <div>
              <div className="frow">
                <label className="flabel">Nome do workspace</label>
                <input className="finput" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="frow">
                <label className="flabel">Emoji</label>
                <input className="finput" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} style={{ width: 80 }} />
              </div>
              <div className="mfoot">
                <button className="btn btn-ghost" onClick={close}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveSettings}>Salvar</button>
              </div>
            </div>
          )}
        </div>

        {tab !== 'settings' && (
          <div className="mfoot" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={close}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal pra criar workspace novo — substitui o prompt() que falhava no Electron
export function NewWorkspaceModal() {
  const open = useWorkspace(s => (s as any).newWsModalOpen);
  const close = useWorkspace(s => (s as any).closeNewWsModal);
  const createNew = useWorkspace(s => s.createNew);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏢');
  const [loading, setLoading] = useState(false);

  const EMOJIS = ['🏢', '🚀', '🎯', '💼', '🏠', '📚', '💡', '🛠️', '🎨', '🔥', '⚡', '🌟'];

  useEffect(() => {
    if (open) { setName(''); setEmoji('🏢'); setLoading(false); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const t = name.trim();
    if (!t) { toast.error('Coloca um nome'); return; }
    setLoading(true);
    try {
      await createNew(t, emoji);
      toast.success(`Workspace "${t}" criado`, { icon: emoji });
      close();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2>🏢 Novo workspace</h2>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: -4, marginBottom: 14 }}>
          Workspace separa contextos — Nex Corp, Pessoal, Cliente X… Você pode estar em vários ao mesmo tempo.
        </p>
        <div className="frow">
          <label className="flabel">Nome</label>
          <input
            autoFocus
            className="finput"
            placeholder="Ex: Nex Corp, Estúdio Pessoal…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        </div>
        <div className="frow">
          <label className="flabel">Emoji</label>
          <div className="cpicker" style={{ flexWrap: 'wrap' }}>
            {EMOJIS.map(e => (
              <div
                key={e}
                className={`copt${e === emoji ? ' sel' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--bg3)' }}
                onClick={() => setEmoji(e)}
              >{e}</div>
            ))}
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Criando…' : 'Criar workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function JoinWorkspaceModal() {
  const open = useWorkspace(s => s.joinModalOpen);
  const close = useWorkspace(s => s.closeJoinModal);
  const join = useWorkspace(s => s.joinByCode);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setCode(''); setLoading(false); } }, [open]);

  if (!open) return null;

  const submit = async () => {
    const t = code.trim();
    const m = t.match(/^(ws_[a-z0-9]+)::?(.+)$/i);
    if (!m) { toast.error('Código inválido. Formato: ws_xxx::aaaa-bbbb'); return; }
    setLoading(true);
    try {
      await join(m[1], m[2].trim());
      toast.success('Você entrou no workspace!', { icon: '🎉' });
      close();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2>🤝 Entrar em workspace</h2>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: -4, marginBottom: 14 }}>
          Cola o código que o dono do workspace te mandou. Formato: <code>ws_xxxx::abcd-efgh</code>
        </p>
        <div className="frow">
          <input
            autoFocus
            className="finput"
            placeholder="ws_xxxx::abcd-efgh"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            style={{ fontFamily: 'Geist Mono, monospace' }}
          />
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

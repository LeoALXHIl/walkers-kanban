import { useEffect, useRef, useState } from 'react';
import { useData, updateCard, addSubtask, setSubtaskStatus, updateSubtask, deleteSubtask, addAttachment, deleteAttachment, addComment, addTagToCard, removeTagFromCard, saveCardAsTemplate, snoozeCard } from '@/store/data';
import { toast } from '@/services/toast';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useNotifications } from '@/store/notifications';
import { CloseIcon, TrashIcon, TextIcon, SubIcon, LinkIcon, ChatIcon, PLAT_LIST, PLAT_LABEL, PLAT_ICON_HTML } from '@/services/icons';
import { CARD_COLORS, pickHashColor, safeUrl } from '@/services/colors';
import { fmt, fmtTime, dueInfo } from '@/services/storage';
import { mdToHtml } from '@/services/markdown';
import { parseSmartDate } from '@/services/time';
import { quickPrompt } from '@/services/quickPrompt';
import { maybeEmailAssignee } from '@/services/assignEmail';
import { CardCustomFields } from './CardCustomFields';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { useWorkspace } from '@/store/workspace';
import type { Card, Platform, Priority, Subtask, SubtaskStatus } from '@/types';

export function CardDetail() {
  const detailCardId = useUI(s => s.detailCardId);
  const closeDetail = useUI(s => s.closeDetail);
  const askDelCard = useUI(s => s.askDelCard);
  const card = useData(s => s.data.cards.find(c => c.id === detailCardId)) as Card | undefined;
  const allCols = useData(s => s.data.cols);
  // Show only columns belonging to the same board as the card (so moving stays in-board)
  const cols = allCols.filter(c => !card?.boardId || !c.boardId || c.boardId === card.boardId);
  const members = useData(s => s.data.members);
  const tags = useData(s => s.data.tags);
  const user = useAuth(s => s.user);
  const addNotif = useNotifications(s => s.add);
  // 'edit' = only textarea, 'split' = side-by-side, 'preview' = only rendered
  const [descMode, setDescMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [snoozeMenu, setSnoozeMenu] = useState<{ x: number; y: number } | null>(null);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [attachTitle, setAttachTitle] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (card && titleRef.current) setTimeout(() => titleRef.current?.focus(), 60);
  }, [card?.id]);

  if (!detailCardId) return null;
  if (!card) { closeDetail(); return null; }

  const col = cols.find(c => c.id === card.cid);
  const subTotal = card.subtasks.length;
  const subDone = card.subtasks.filter(s => s.done).length;

  const onTitle = (v: string) => updateCard(card.id, { name: v });
  const onDesc = (v: string) => updateCard(card.id, { desc: v });
  const onNote = (v: string) => updateCard(card.id, { note: v });
  const onCol = (v: string) => updateCard(card.id, { cid: v });
  const onPrio = (v: Priority) => updateCard(card.id, { prio: v });
  const onAssignee = (v: string) => {
    const prev = card.assignee;
    const nv = v.trim() || null;
    updateCard(card.id, { assignee: nv });
    maybeEmailAssignee({ assignee: nv, prevAssignee: prev, cardName: card.name, due: card.due });
  };
  const onDue = (v: string) => updateCard(card.id, { due: v || null });
  const onColor = (h: string) => updateCard(card.id, { color: h });
  const togglePlat = (p: Platform) => {
    const next = card.plat.includes(p) ? card.plat.filter(x => x !== p) : [...card.plat, p];
    updateCard(card.id, { plat: next });
  };

  const onAddSubtask = () => {
    const t = subtaskInput.trim();
    if (!t) return;
    addSubtask(card.id, t);
    setSubtaskInput('');
  };

  const onAddAttach = () => {
    const u = attachUrl.trim();
    if (!u) return;
    addAttachment(card.id, attachTitle.trim(), u);
    setAttachTitle('');
    setAttachUrl('');
  };

  const onAddComment = () => {
    const t = commentInput.trim();
    if (!t) return;
    const author = user?.displayName || user?.email?.split('@')[0] || card.assignee || 'Eu';
    addComment(card.id, t, author);
    setCommentInput('');
    addNotif({ type: 'comment', icon: '💬', title: `Comentário em ${card.name}`, sub: t.slice(0, 60), ts: Date.now(), cardId: card.id });
  };

  const onPromptTag = async () => {
    const name = await quickPrompt({
      title: 'Nova etiqueta',
      placeholder: 'Ex: urgente, retorno, vip…',
      okLabel: 'Adicionar'
    });
    if (!name || !name.trim()) return;
    addTagToCard(card.id, name.trim(), tags.length);
  };

  const onDeleteFromDetail = () => {
    askDelCard(card.id);
    closeDetail();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}>
      <div className="modal detail-modal">
        <div className="detail-head">
          <div className="detail-color-bar" style={{ background: card.color || '#7c5cfc' }} />
          <div className="detail-title-wrap">
            <input
              ref={titleRef}
              className="detail-title"
              value={card.name}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Nome do cliente"
            />
            <div className="detail-breadcrumb">{(col?.name || '—') + ' · criado ' + fmt(card.ts || Date.now())}</div>
          </div>
          <button className="detail-close" onClick={closeDetail}>
            <CloseIcon />
          </button>
        </div>

        <div className="detail-body">
          <div className="detail-main">
            <div className="d-section">
              <div className="d-sec-title">
                <TextIcon />
                Descrição
                <div className="desc-mode-toggle" style={{ marginLeft: 'auto' }}>
                  <button className={`desc-mode-btn${descMode === 'edit' ? ' active' : ''}`} onClick={() => setDescMode('edit')} title="Só editor">✏️</button>
                  <button className={`desc-mode-btn${descMode === 'split' ? ' active' : ''}`} onClick={() => setDescMode('split')} title="Editor + preview lado a lado">⇆</button>
                  <button className={`desc-mode-btn${descMode === 'preview' ? ' active' : ''}`} onClick={() => setDescMode('preview')} title="Só preview">👁</button>
                </div>
              </div>
              <div className={`desc-wrap mode-${descMode}`}>
                {descMode !== 'preview' && (
                  <textarea
                    className="detail-desc"
                    value={card.desc}
                    onChange={(e) => onDesc(e.target.value)}
                    placeholder="Descreva o cliente, escopo, decisões… (Markdown + code blocks ```js suportados)"
                  />
                )}
                {descMode !== 'edit' && (
                  <div className="desc-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(card.desc) }} />
                )}
              </div>
            </div>

            <CardCustomFields card={card} />

            <div className="d-section">
              <div className="d-sec-title">
                <SubIcon />
                Subtarefas
              </div>
              <div className="subtask-progress">
                <div className="subtask-bar"><div className="subtask-bar-fill" style={{ width: subTotal ? `${(subDone / subTotal) * 100}%` : '0%' }} /></div>
                <span className="subtask-count">{subDone}/{subTotal}</span>
              </div>
              <div className="subtask-list">
                {card.subtasks.map(s => (
                  <SubtaskRow key={s.id} cardId={card.id} cardName={card.name} sub={s} workspaceMembers={members} />
                ))}
              </div>
              <div className="subtask-add">
                <input
                  placeholder="Adicionar subtarefa…"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddSubtask(); }}
                />
                <button onClick={onAddSubtask}>+</button>
              </div>
            </div>

            <div className="d-section">
              <div className="d-sec-title">
                <LinkIcon />
                Anexos / Links
              </div>
              <div className="attach-list">
                {card.attachments.length === 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>Nenhum anexo.</div>
                ) : card.attachments.map(a => {
                  const safe = safeUrl(a.url);
                  return (
                    <div key={a.id} className="attach-item">
                      <span
                        className="attach-link"
                        title={a.url}
                        onClick={() => safe && window.walkersAPI.openExternal(safe)}
                        style={{ cursor: safe ? 'pointer' : 'default', color: safe ? 'var(--accent)' : 'var(--text3)' }}
                      >
                        {a.title || a.url}
                      </span>
                      <button className="attach-del" onClick={() => deleteAttachment(card.id, a.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="attach-add">
                <input placeholder="Título do link" value={attachTitle} onChange={(e) => setAttachTitle(e.target.value)} />
                <input
                  placeholder="https://…"
                  value={attachUrl}
                  onChange={(e) => setAttachUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddAttach(); }}
                />
                <button className="btn btn-ghost" onClick={onAddAttach} style={{ alignSelf: 'flex-start', fontSize: 11, padding: '5px 10px' }}>+ Link</button>
              </div>
            </div>

            <div className="d-section">
              <div className="d-sec-title">
                <ChatIcon />
                Comentários
              </div>
              <div className="comment-list">
                {card.comments.length === 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>Nenhum comentário.</div>
                ) : card.comments.map(cm => {
                  const author = cm.author || 'Anônimo';
                  // Match against workspace member to get real avatar/email
                  const wsMember = useWorkspace.getState().currentWorkspace?.members.find(
                    m => m.displayName === author || m.email === author
                  );
                  const avatarBg = wsMember?.photoURL ? `url(${wsMember.photoURL}) center/cover` : pickHashColor(author);
                  return (
                    <div key={cm.id} className="comment-item">
                      <div className="comment-header">
                        <div className="comment-avatar" style={{ background: avatarBg }} title={wsMember?.email}>
                          {!wsMember?.photoURL && author.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="comment-author">{author}</span>
                        {wsMember && <span style={{ fontSize: 9, color: 'var(--text3)' }}>· {wsMember.role}</span>}
                        <span className="comment-time">{fmtTime(cm.ts)}</span>
                      </div>
                      <div className="comment-text">{cm.text}</div>
                    </div>
                  );
                })}
              </div>
              <div className="comment-add">
                <input
                  placeholder="Adicionar comentário…"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddComment(); }}
                />
                <button className="btn btn-ghost" onClick={onAddComment} style={{ fontSize: 11, padding: '5px 10px' }}>Enviar</button>
              </div>
            </div>
          </div>

          <div className="detail-side">
            <div className="side-field">
              <div className="side-label">Coluna</div>
              <select className="side-sel" value={card.cid} onChange={(e) => onCol(e.target.value)}>
                {cols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="side-field">
              <div className="side-label">Prioridade</div>
              <select className="side-sel" value={card.prio} onChange={(e) => onPrio(e.target.value as Priority)}>
                <option value="high">🔴 Alta</option>
                <option value="med">🟡 Média</option>
                <option value="low">🟢 Baixa</option>
              </select>
            </div>
            <div className="side-field">
              <div className="side-label">Responsável</div>
              <AssigneePicker
                value={card.assignee}
                onChange={onAssignee}
                workspaceMembers={members}
              />
            </div>
            <div className="side-field">
              <div className="side-label">Vencimento</div>
              <input
                type="date"
                className="side-inp"
                value={card.due || ''}
                onChange={(e) => onDue(e.target.value)}
              />
              <input
                className="side-inp"
                style={{ marginTop: 4, fontSize: 11 }}
                placeholder="ou: amanhã, sex, em 3 dias, 30/06…"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) return;
                  const parsed = parseSmartDate(v);
                  if (parsed) {
                    onDue(parsed);
                    e.currentTarget.value = '';
                    toast.success(`Data: ${new Date(parsed + 'T00:00:00').toLocaleDateString('pt-BR')}`, { icon: '📅', durationMs: 2000 });
                  } else {
                    toast.error(`Não entendi "${v}". Tenta: amanhã, sex, em 3 dias, 30/06`);
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
              />
            </div>
            <div className="side-field">
              <div className="side-label">Plataformas</div>
              <div className="fchecks" style={{ gap: 3 }}>
                {PLAT_LIST.map(p => (
                  <label key={p} className={`chk-lbl${card.plat.includes(p) ? ' active' : ''}`} style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => togglePlat(p)}>
                    <span dangerouslySetInnerHTML={{ __html: PLAT_ICON_HTML[p] }} />
                    {PLAT_LABEL[p]}
                  </label>
                ))}
              </div>
            </div>
            <div className="side-field">
              <div className="side-label">Cor</div>
              <div className="cpicker" style={{ gap: 4 }}>
                {CARD_COLORS.map(h => (
                  <div
                    key={h}
                    className={`copt${h === (card.color || '#7c5cfc') ? ' sel' : ''}`}
                    style={{ background: h, width: 17, height: 17 }}
                    onClick={() => onColor(h)}
                  />
                ))}
              </div>
            </div>
            <div className="side-field">
              <div className="side-label">Imagem de capa</div>
              <input
                className="side-inp"
                type="url"
                value={card.coverUrl || ''}
                onChange={(e) => updateCard(card.id, { coverUrl: e.target.value.trim() || undefined })}
                placeholder="https://… (URL da imagem)"
              />
              {card.coverUrl && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 10, padding: '4px 8px', marginTop: 4 }}
                  onClick={() => updateCard(card.id, { coverUrl: undefined })}
                >🗑️ Remover capa</button>
              )}
            </div>
            <div className="side-field">
              <div className="side-label">Etiquetas</div>
              <div className="tag-editor">
                {card.tagIds.map(tid => {
                  const t = tags.find(x => x.id === tid);
                  if (!t) return null;
                  return (
                    <span key={tid} className="tag-chip" style={{ background: `${t.color}22`, color: t.color }}>
                      {t.name}
                      <span className="tx" onClick={() => removeTagFromCard(card.id, tid)}>✕</span>
                    </span>
                  );
                })}
                <span className="tag-add-btn" onClick={onPromptTag}>+ tag</span>
              </div>
            </div>
            <div className="side-field">
              <div className="side-label">Observação rápida</div>
              <textarea
                className="side-inp"
                value={card.note}
                onChange={(e) => onNote(e.target.value)}
                style={{ minHeight: 50, resize: 'vertical', fontFamily: "'Geist', sans-serif" }}
              />
            </div>
          </div>
        </div>

        <div className="detail-foot">
          <span className="detail-foot-meta">
            ID: {card.id}
            {card.snoozedUntil && card.snoozedUntil > Date.now() && (
              <> · 😴 Snoozed até {new Date(card.snoozedUntil).toLocaleDateString('pt-BR')}</>
            )}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {card.snoozedUntil && card.snoozedUntil > Date.now() ? (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  snoozeCard(card.id, null);
                  toast.success('Card acordado', { icon: '☀️', durationMs: 2000 });
                }}
                title="Acordar o card agora"
              >
                ☀️ Acordar
              </button>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setSnoozeMenu({ x: rect.left, y: rect.top - 8 });
                }}
                title="Esconder o card até uma data — volta sozinho"
              >
                😴 Snooze
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => {
                // Try to find the client's email from ClientProfiles for prefilled attendee
                const clientKey = card.name.toLowerCase().split(/[-–—]/)[0].trim();
                const profile = useData.getState().data.clientProfiles?.[clientKey];
                const attendees = profile?.email ? [profile.email] : [];
                useUI.getState().openMeetingModal({
                  title: `Reunião — ${card.name}`,
                  description: card.desc || card.note || '',
                  attendees,
                  cardId: card.id
                });
              }}
              title="Agendar reunião no Google Calendar vinculada a este card"
            >
              📅 Agendar reunião
            </button>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                const tplName = await quickPrompt({
                  title: 'Salvar como template',
                  message: 'Esse card vai virar um template reutilizável. Use {{cliente}} no nome pra substituir depois.',
                  placeholder: 'Ex: Implementação WhatsApp Magazord',
                  defaultValue: card.name,
                  okLabel: 'Próximo'
                });
                if (!tplName || !tplName.trim()) return;
                const emoji = await quickPrompt({
                  title: 'Emoji do template',
                  message: 'Escolhe um emoji pra reconhecer fácil (ou deixa vazio).',
                  placeholder: '📋 🚀 ⚡ 🎯',
                  defaultValue: '📋',
                  okLabel: 'Salvar template'
                });
                const id = saveCardAsTemplate(card.id, tplName, emoji || '📋');
                if (id) toast.success(`Template "${tplName}" salvo`, { icon: emoji || '📋', durationMs: 3500 });
              }}
              title="Salvar este card como template reutilizável"
            >
              💾 Salvar como template
            </button>
            <button className="btn btn-danger" onClick={onDeleteFromDetail}>
              <TrashIcon /> Excluir
            </button>
          </div>
        </div>
      </div>

      {snoozeMenu && (() => {
        const doSnooze = (days: number, label: string) => {
          const t = new Date();
          t.setDate(t.getDate() + days);
          t.setHours(9, 0, 0, 0);
          snoozeCard(card.id, t.getTime());
          toast.success(`Adormecido por ${label}`, { icon: '😴', durationMs: 2500 });
          setSnoozeMenu(null);
          closeDetail();
        };
        const doSnoozeNextMonday = () => {
          const t = new Date();
          const cur = t.getDay();
          const delta = (1 - cur + 7) % 7 || 7;
          t.setDate(t.getDate() + delta);
          t.setHours(9, 0, 0, 0);
          snoozeCard(card.id, t.getTime());
          toast.success(`Adormecido até segunda`, { icon: '😴', durationMs: 2500 });
          setSnoozeMenu(null);
          closeDetail();
        };
        const items: MenuItem[] = [
          { label: 'Amanhã (9h)', icon: '☀️', onClick: () => doSnooze(1, 'amanhã') },
          { label: 'Próx segunda', icon: '📅', onClick: doSnoozeNextMonday },
          { label: 'Em 3 dias', icon: '⏭️', onClick: () => doSnooze(3, '3 dias') },
          { label: 'Próx semana (7d)', icon: '🗓️', onClick: () => doSnooze(7, '7 dias') },
          { label: 'Próx mês (30d)', icon: '📆', onClick: () => doSnooze(30, '30 dias') },
          { divider: true, label: '' },
          { label: 'Data customizada…', icon: '🎯', onClick: async () => {
            const s = await quickPrompt({
              title: 'Adormecer até quando?',
              message: 'Digita uma data no formato AAAA-MM-DD',
              placeholder: '2025-12-31',
              okLabel: 'Adormecer'
            });
            if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
              const ts = new Date(s + 'T09:00:00').getTime();
              snoozeCard(card.id, ts);
              toast.success(`Adormecido até ${new Date(ts).toLocaleDateString('pt-BR')}`, { icon: '😴' });
              closeDetail();
            } else if (s) {
              toast.error('Formato inválido — use AAAA-MM-DD');
            }
          }}
        ];
        return <ContextMenu x={snoozeMenu.x} y={snoozeMenu.y} items={items} onClose={() => setSnoozeMenu(null)} />;
      })()}
    </div>
  );
}

// ─── Subtask row: status + responsável + vencimento + observação ───
const SUB_STATUS: Record<SubtaskStatus, { label: string; icon: string; cls: string }> = {
  todo:  { label: 'Pendente',     icon: '○', cls: 'st-todo' },
  doing: { label: 'Em andamento', icon: '◐', cls: 'st-doing' },
  done:  { label: 'Concluída',    icon: '✓', cls: 'st-done' }
};
const STATUS_CYCLE: SubtaskStatus[] = ['todo', 'doing', 'done'];

function subStatus(s: Subtask): SubtaskStatus {
  return s.status || (s.done ? 'done' : 'todo');
}

function SubtaskRow({ cardId, cardName, sub, workspaceMembers }: { cardId: string; cardName: string; sub: Subtask; workspaceMembers: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(sub.text);
  const status = subStatus(sub);
  const meta = SUB_STATUS[status];

  const cycle = () => {
    const idx = STATUS_CYCLE.indexOf(status);
    setSubtaskStatus(cardId, sub.id, STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  };

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== sub.text) updateSubtask(cardId, sub.id, { text: t });
    else setTitleDraft(sub.text);
    setEditingTitle(false);
  };

  return (
    <div className={`subtask-item st-rich ${meta.cls}${expanded ? ' expanded' : ''}`}>
      <div className="subtask-head">
        <button className={`subtask-status-btn ${meta.cls}`} onClick={cycle} title={`Status: ${meta.label} (clique p/ mudar)`}>
          <span className="ssb-icon">{meta.icon}</span>
        </button>
        {editingTitle ? (
          <input
            className="subtask-title-edit"
            value={titleDraft}
            autoFocus
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(sub.text); setEditingTitle(false); } }}
          />
        ) : (
          <span className={`subtask-text${status === 'done' ? ' done' : ''}`} onClick={() => { setTitleDraft(sub.text); setEditingTitle(true); }}>{sub.text}</span>
        )}
        {sub.assignee && (
          <span className="subtask-assignee-chip" title={`Responsável: ${sub.assignee}`}>
            <span className="card-avatar" style={{ width: 16, height: 16, fontSize: 8, background: pickHashColor(sub.assignee) }}>{sub.assignee.slice(0, 2).toUpperCase()}</span>
          </span>
        )}
        {sub.due && (() => {
          const di = dueInfo(sub.due);
          return di ? <span className={`task-due-badge card-due ${di.cls}`}>{di.label}</span> : null;
        })()}
        <button className="subtask-expand" onClick={() => setExpanded(e => !e)} title="Detalhes">{expanded ? '▴' : '▾'}</button>
        <button className="subtask-del" onClick={() => deleteSubtask(cardId, sub.id)}>
          <TrashIcon />
        </button>
      </div>
      {expanded && (
        <div className="subtask-body">
          <div className="subtask-field">
            <label>Status</label>
            <div className="subtask-status-pills">
              {STATUS_CYCLE.map(st => (
                <button
                  key={st}
                  className={`st-pill ${SUB_STATUS[st].cls}${status === st ? ' active' : ''}`}
                  onClick={() => setSubtaskStatus(cardId, sub.id, st)}
                >{SUB_STATUS[st].icon} {SUB_STATUS[st].label}</button>
              ))}
            </div>
          </div>
          <div className="subtask-field">
            <label>Responsável</label>
            <AssigneePicker value={sub.assignee ?? null} onChange={(v) => {
              const prev = sub.assignee;
              const nv = v.trim() || null;
              updateSubtask(cardId, sub.id, { assignee: nv });
              maybeEmailAssignee({ assignee: nv, prevAssignee: prev, cardName, subText: sub.text, due: sub.due });
            }} workspaceMembers={workspaceMembers} />
          </div>
          <div className="subtask-field">
            <label>Vencimento</label>
            <input type="date" className="side-inp" value={sub.due || ''} onChange={(e) => updateSubtask(cardId, sub.id, { due: e.target.value || null })} />
          </div>
          <div className="subtask-field">
            <label>Observação</label>
            <textarea
              className="subtask-note"
              placeholder="Anotações sobre esta subtarefa…"
              value={sub.note || ''}
              rows={2}
              onChange={(e) => updateSubtask(cardId, sub.id, { note: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assignee picker: dropdown com membros do workspace ───
function AssigneePicker({ value, onChange, workspaceMembers }: { value: string | null; onChange: (v: string) => void; workspaceMembers: string[] }) {
  const ws = useWorkspace(s => s.currentWorkspace);
  const wsMembers = ws?.members || [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Find member by display name match (fallback for legacy free-text)
  const matched = wsMembers.find(m => m.displayName === value || m.email === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="side-inp"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer' }}
      >
        {value ? (
          <>
            <span
              className="card-avatar"
              style={{ width: 18, height: 18, fontSize: 9, background: matched?.photoURL ? `url(${matched.photoURL})` : pickHashColor(value), flexShrink: 0 }}
            >
              {!matched?.photoURL && value.slice(0, 2).toUpperCase()}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            <span
              style={{ color: 'var(--text3)', cursor: 'pointer', padding: '0 4px' }}
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              title="Remover responsável"
            >✕</span>
          </>
        ) : (
          <span style={{ color: 'var(--text3)' }}>Sem responsável</span>
        )}
        <span style={{ color: 'var(--text3)', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--rs)',
          padding: 4, zIndex: 100, maxHeight: 240, overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)'
        }}>
          <button
            className="bm-item"
            onClick={() => { onChange(''); setOpen(false); }}
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text3)' }}
          >
            <span style={{ fontSize: 13 }}>○</span>
            <span>Sem responsável</span>
          </button>
          {wsMembers.length > 0 && (
            <>
              <div className="bm-sep" />
              <div className="bm-section">Equipe ({wsMembers.length})</div>
              {wsMembers.map(m => (
                <button
                  key={m.uid}
                  className={`bm-item${m.displayName === value ? ' active' : ''}`}
                  onClick={() => { onChange(m.displayName); setOpen(false); }}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <span
                    className="card-avatar"
                    style={{ width: 22, height: 22, fontSize: 10, background: pickHashColor(m.displayName), flexShrink: 0 }}
                  >{m.displayName.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{m.displayName}</span>
                  {m.displayName === value && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </button>
              ))}
            </>
          )}
          {workspaceMembers.length > 0 && workspaceMembers.filter(n => !wsMembers.find(m => m.displayName === n)).length > 0 && (
            <>
              <div className="bm-sep" />
              <div className="bm-section">Legado</div>
              {workspaceMembers.filter(n => !wsMembers.find(m => m.displayName === n)).slice(0, 5).map(n => (
                <button
                  key={n}
                  className="bm-item"
                  onClick={() => { onChange(n); setOpen(false); }}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <span
                    className="card-avatar"
                    style={{ width: 22, height: 22, fontSize: 10, background: pickHashColor(n), flexShrink: 0 }}
                  >{n.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{n}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

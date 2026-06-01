import { useMemo, useState } from 'react';
import { useData, addTemplate, updateTemplate, deleteTemplate, createCardFromTemplate } from '@/store/data';
import { useUI } from '@/store/ui';
import { toast } from '@/services/toast';
import { quickPrompt } from '@/services/quickPrompt';
import { TrashIcon, EditIcon, PlusIcon } from '@/services/icons';
import { CARD_COLORS } from '@/services/colors';
import { PLAT_LIST, PLAT_LABEL, PLAT_ICON_HTML } from '@/services/icons';
import type { CardTemplate, Platform, Priority } from '@/types';

const EMOJI_SUGGESTIONS = ['📋', '⚡', '🚀', '💬', '🎯', '🔧', '🌐', '📦', '🤝', '⭐'];

export function TemplatesView() {
  const templates = useData(s => s.data.templates || []);
  const allCols = useData(s => s.data.cols);
  const activeBoardId = useData(s => s.data.activeBoardId);
  const cols = allCols.filter(c => !c.boardId || c.boardId === activeBoardId);
  const openCardDetail = useUI(s => s.openDetail);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId ? templates.find(t => t.id === editingId) : null;
  const formMode = creating || !!editing;

  const sortedTemplates = useMemo(() =>
    [...templates].sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || b.updatedAt - a.updatedAt),
    [templates]
  );

  const handleUse = async (template: CardTemplate) => {
    const clientName = await quickPrompt({
      title: `Usar template: ${template.name}`,
      message: 'Nome do cliente pra substituir {{cliente}} no card. Deixa vazio pra criar com o nome default do template.',
      placeholder: 'Ex: Loja da Maria',
      okLabel: 'Criar card'
    });
    if (clientName === null) return;
    const card = createCardFromTemplate(template.id, clientName.trim() || 'Novo card', undefined);
    if (card) {
      toast.success(`Card "${card.name}" criado de template`, { icon: '✨', durationMs: 3500 });
      setTimeout(() => openCardDetail(card.id), 150);
    }
  };

  const handleDelete = (template: CardTemplate) => {
    if (!confirm(`Deletar template "${template.name}"? Cards já criados a partir dele continuam existindo.`)) return;
    deleteTemplate(template.id);
    toast.warn(`Template "${template.name}" deletado`, { icon: '🗑️' });
  };

  if (formMode) {
    return <TemplateForm
      initial={editing}
      cols={cols}
      onSubmit={(form) => {
        if (editing) {
          updateTemplate(editing.id, form);
          toast.success('Template atualizado', { icon: '✓' });
        } else {
          addTemplate(form);
          toast.success(`Template "${form.name}" criado`, { icon: '✓' });
        }
        setCreating(false);
        setEditingId(null);
      }}
      onCancel={() => { setCreating(false); setEditingId(null); }}
    />;
  }

  return (
    <div className="templates-view">
      <div className="templates-head">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Templates</h2>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
            Crie templates pra implementações recorrentes — cliente novo vira card em 1 clique com subtarefas e tudo pré-preenchido.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <PlusIcon /> Novo template
        </button>
      </div>

      {sortedTemplates.length === 0 ? (
        <div className="board-empty">
          <div className="board-empty-emoji">📋</div>
          <h2 className="board-empty-title">Sem templates ainda</h2>
          <p className="board-empty-sub">
            Crie um template a partir do botão acima OU abra um card existente e clique em "Salvar como template" no rodapé.
          </p>
          <div className="board-empty-actions">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Criar primeiro template</button>
          </div>
        </div>
      ) : (
        <div className="templates-grid">
          {sortedTemplates.map(t => (
            <div key={t.id} className="template-card">
              <div className="template-card-head">
                <div className="template-emoji">{t.emoji || '📋'}</div>
                <div className="template-name-wrap">
                  <div className="template-name">{t.name}</div>
                  {t.description && <div className="template-desc">{t.description}</div>}
                </div>
              </div>
              <div className="template-meta">
                {t.defaults.subtasks && t.defaults.subtasks.length > 0 && (
                  <span className="template-meta-pill">📋 {t.defaults.subtasks.length} subtarefas</span>
                )}
                {t.defaults.plat && t.defaults.plat.length > 0 && t.defaults.plat.map(p => (
                  <span key={p} className="template-meta-pill">{PLAT_LABEL[p]}</span>
                ))}
                {t.defaults.prio && t.defaults.prio !== 'med' && (
                  <span className="template-meta-pill">
                    {t.defaults.prio === 'high' ? '🔴 Alta' : '🟢 Baixa'}
                  </span>
                )}
                {(t.useCount || 0) > 0 && (
                  <span className="template-meta-pill" style={{ marginLeft: 'auto', opacity: .65 }}>Usado {t.useCount}×</span>
                )}
              </div>
              <div className="template-actions">
                <button className="btn btn-primary" onClick={() => handleUse(t)} style={{ flex: 1 }}>
                  ✨ Usar template
                </button>
                <button className="card-btn" title="Editar" onClick={() => setEditingId(t.id)}>
                  <EditIcon />
                </button>
                <button className="card-btn" title="Deletar" onClick={() => handleDelete(t)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Template form ─────────────────────────────────────────────────────
interface TemplateFormProps {
  initial: CardTemplate | null | undefined;
  cols: { id: string; name: string }[];
  onSubmit: (form: Omit<CardTemplate, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>) => void;
  onCancel: () => void;
}

function TemplateForm({ initial, cols, onSubmit, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '📋');
  const [description, setDescription] = useState(initial?.description || '');
  const [cardName, setCardName] = useState(initial?.defaults.name || '{{cliente}}');
  const [cid, setCid] = useState(initial?.defaults.cid || cols[0]?.id || '');
  const [prio, setPrio] = useState<Priority>(initial?.defaults.prio || 'med');
  const [plat, setPlat] = useState<Platform[]>(initial?.defaults.plat || []);
  const [color, setColor] = useState(initial?.defaults.color || '#7c5cfc');
  const [note, setNote] = useState(initial?.defaults.note || '');
  const [desc, setDesc] = useState(initial?.defaults.desc || '');
  const [tagNamesStr, setTagNamesStr] = useState((initial?.defaults.tagNames || []).join(', '));
  const [subtasksStr, setSubtasksStr] = useState((initial?.defaults.subtasks || []).map(s => s.text).join('\n'));

  const togglePlat = (p: Platform) => setPlat(cur => cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p]);

  const submit = () => {
    if (!name.trim()) { toast.error('Nome do template é obrigatório'); return; }
    onSubmit({
      name: name.trim(),
      emoji: emoji.trim() || undefined,
      description: description.trim() || undefined,
      defaults: {
        name: cardName.trim() || undefined,
        cid: cid || undefined,
        prio,
        plat,
        color,
        note: note.trim() || undefined,
        desc: desc.trim() || undefined,
        tagNames: tagNamesStr.split(',').map(t => t.trim()).filter(Boolean),
        subtasks: subtasksStr.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text }))
      }
    });
  };

  return (
    <div className="templates-view">
      <div className="templates-head">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{initial ? 'Editar template' : 'Novo template'}</h2>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
            Use <code>&#123;&#123;cliente&#125;&#125;</code> no nome do card / nota / descrição — será substituído pelo nome do cliente ao usar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>💾 Salvar template</button>
        </div>
      </div>

      <div className="template-form">
        <div className="profile-grid">
          <div className="frow">
            <label className="flabel">Nome do template *</label>
            <input className="finput" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Implementação WhatsApp Magazord" autoFocus />
          </div>
          <div className="frow">
            <label className="flabel">Emoji</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input className="finput" value={emoji} onChange={e => setEmoji(e.target.value)} style={{ width: 70, textAlign: 'center', fontSize: 16 }} />
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {EMOJI_SUGGESTIONS.map(em => (
                  <button key={em} type="button" className="card-btn" style={{ fontSize: 14 }} onClick={() => setEmoji(em)}>{em}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="frow">
          <label className="flabel">Descrição curta</label>
          <input className="finput" value={description} onChange={e => setDescription(e.target.value)} placeholder="Pra que esse template serve" />
        </div>

        <h3 style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 18, marginBottom: 4 }}>Padrões do card</h3>

        <div className="profile-grid">
          <div className="frow">
            <label className="flabel">Nome do card</label>
            <input className="finput" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="{{cliente}} - Implementação WhatsApp" />
          </div>
          <div className="frow">
            <label className="flabel">Coluna</label>
            <select className="fsel" value={cid} onChange={e => setCid(e.target.value)}>
              {cols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="frow">
            <label className="flabel">Prioridade</label>
            <select className="fsel" value={prio} onChange={e => setPrio(e.target.value as Priority)}>
              <option value="high">Alta</option>
              <option value="med">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <div className="frow">
            <label className="flabel">Cor</label>
            <div className="cpicker">
              {CARD_COLORS.map(h => (
                <div key={h} className={`copt${h === color ? ' sel' : ''}`} style={{ background: h }} onClick={() => setColor(h)} />
              ))}
            </div>
          </div>
        </div>

        <div className="frow">
          <label className="flabel">Plataformas</label>
          <div className="fchecks">
            {PLAT_LIST.map(p => (
              <label key={p} className={`chk-lbl${plat.includes(p) ? ' active' : ''}`} onClick={() => togglePlat(p)}>
                <span dangerouslySetInnerHTML={{ __html: PLAT_ICON_HTML[p] }} />
                {PLAT_LABEL[p]}
              </label>
            ))}
          </div>
        </div>

        <div className="profile-grid">
          <div className="frow">
            <label className="flabel">Tags (vírgula-separadas)</label>
            <input className="finput" value={tagNamesStr} onChange={e => setTagNamesStr(e.target.value)} placeholder="magazord, urgente" />
          </div>
          <div className="frow">
            <label className="flabel">Observação rápida</label>
            <input className="finput" value={note} onChange={e => setNote(e.target.value)} placeholder="Aguardando dados do {{cliente}}..." />
          </div>
        </div>

        <div className="frow">
          <label className="flabel">Descrição (markdown)</label>
          <textarea className="ftxt" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Detalhes da implementação..." style={{ minHeight: 80 }} />
        </div>

        <div className="frow">
          <label className="flabel">Subtarefas (uma por linha)</label>
          <textarea className="ftxt" value={subtasksStr} onChange={e => setSubtasksStr(e.target.value)} placeholder={`Mapear campos do funil\nConfigurar gatilhos\nTestar fluxo de saudação\nValidar com cliente\nDeploy em produção`} style={{ minHeight: 140, fontFamily: "'Geist Mono', monospace", fontSize: 12 }} />
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            {subtasksStr.split('\n').filter(s => s.trim()).length} subtarefas serão criadas
          </div>
        </div>
      </div>
    </div>
  );
}

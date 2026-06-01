import { useState, useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useData, addCustomField, updateCustomField, deleteCustomField } from '@/store/data';
import { toast } from '@/services/toast';
import type { CustomFieldType } from '@/types';

const TYPE_OPTIONS: { value: CustomFieldType; label: string; icon: string; hint: string }[] = [
  { value: 'text',     label: 'Texto',    icon: '📝', hint: 'Texto livre' },
  { value: 'number',   label: 'Número',   icon: '#️⃣', hint: 'Inteiro ou decimal' },
  { value: 'url',      label: 'URL',      icon: '🔗', hint: 'Link clicável (webhook, API endpoint...)' },
  { value: 'currency', label: 'Valor R$', icon: '💰', hint: 'Moeda em reais' },
  { value: 'date',     label: 'Data',     icon: '📅', hint: 'Data específica' },
  { value: 'select',   label: 'Seleção',  icon: '🎯', hint: 'Lista de opções (status, categoria…)' }
];

export function CustomFieldsModal() {
  const open = useUI(s => s.customFieldsModalOpen);
  const close = useUI(s => s.closeCustomFieldsModal);
  const data = useData(s => s.data);
  const activeBoardId = data.activeBoardId || '';
  const currentBoard = data.boards?.find(b => b.id === activeBoardId);
  const fields = (data.customFields || []).filter(f => f.boardId === activeBoardId).sort((a, b) => a.position - b.position);

  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [showOnCard, setShowOnCard] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreating(false); setEditId(null);
      return;
    }
  }, [open]);

  const startCreate = () => {
    setCreating(true); setEditId(null);
    setName(''); setType('text'); setOptionsRaw(''); setShowOnCard(false);
  };

  const startEdit = (id: string) => {
    const f = fields.find(x => x.id === id);
    if (!f) return;
    setEditId(id); setCreating(false);
    setName(f.name); setType(f.type);
    setOptionsRaw((f.options || []).join('\n'));
    setShowOnCard(!!f.showOnCard);
  };

  const cancel = () => { setCreating(false); setEditId(null); };

  const save = () => {
    const t = name.trim();
    if (!t) { toast.error('Dá um nome pro campo'); return; }
    const opts = type === 'select'
      ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined;
    if (type === 'select' && (!opts || opts.length === 0)) {
      toast.error('Lista de opções não pode ficar vazia'); return;
    }
    if (editId) {
      updateCustomField(editId, { name: t, type, options: opts, showOnCard });
      toast.success(`Campo "${t}" atualizado`);
    } else {
      addCustomField(activeBoardId, t, type, opts);
      // Set showOnCard after creation (addCustomField doesn't take it)
      // we need the new id — easier: re-find by name+boardId
      setTimeout(() => {
        const created = useData.getState().data.customFields?.find(f => f.boardId === activeBoardId && f.name === t);
        if (created && showOnCard) updateCustomField(created.id, { showOnCard: true });
      }, 0);
      toast.success(`Campo "${t}" criado`);
    }
    cancel();
  };

  const del = (id: string) => {
    const f = fields.find(x => x.id === id);
    if (!f) return;
    if (!confirm(`Excluir o campo "${f.name}"? Os valores preenchidos nos cards serão perdidos.`)) return;
    deleteCustomField(id);
    toast.success(`Campo "${f.name}" excluído`);
  };

  if (!open) return null;

  const formMode = creating || !!editId;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          🏷️ Custom Fields
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
            · {currentBoard?.emoji} {currentBoard?.name}
          </span>
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)', margin: '-6px 0 12px' }}>
          Campos extras pra cards desse board — URL de webhook, API key, valor, status, etc.
        </p>

        {!formMode && (
          <>
            {fields.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Nenhum custom field ainda.<br />
                <small>Adicione campos pra capturar dados específicos do seu fluxo.</small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {fields.map(f => {
                  const meta = TYPE_OPTIONS.find(t => t.value === f.type);
                  return (
                    <div key={f.id} className="cf-row">
                      <span style={{ fontSize: 14 }}>{meta?.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                          {meta?.label}
                          {f.type === 'select' && f.options ? ` · ${f.options.length} opções` : ''}
                          {f.showOnCard ? ' · 👁 visível no card' : ''}
                        </div>
                      </div>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => startEdit(f.id)}>✏️</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => del(f.id)}>🗑️</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="btn btn-primary" onClick={startCreate} style={{ width: '100%' }}>➕ Adicionar campo</button>
          </>
        )}

        {formMode && (
          <>
            <div className="frow">
              <label className="flabel">Nome do campo</label>
              <input
                className="finput"
                placeholder="Ex: URL do Webhook, API Key, Valor cobrado…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="frow">
              <label className="flabel">Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`type-opt${type === opt.value ? ' sel' : ''}`}
                    onClick={() => setType(opt.value)}
                  >
                    <div style={{ fontSize: 14 }}>{opt.icon} {opt.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>
            {type === 'select' && (
              <div className="frow">
                <label className="flabel">Opções (uma por linha)</label>
                <textarea
                  className="finput"
                  rows={4}
                  placeholder={'Em análise\nAprovado\nRecusado'}
                  value={optionsRaw}
                  onChange={(e) => setOptionsRaw(e.target.value)}
                />
              </div>
            )}
            <div className="frow">
              <label className="flabel" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showOnCard} onChange={(e) => setShowOnCard(e.target.checked)} />
                Mostrar valor no preview do card
              </label>
            </div>
            <div className="mfoot">
              <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editId ? 'Salvar' : 'Criar campo'}</button>
            </div>
          </>
        )}

        {!formMode && (
          <div className="mfoot" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={close}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

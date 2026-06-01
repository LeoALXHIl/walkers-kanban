import { useState } from 'react';
import { useData, setCardCustomValue } from '@/store/data';
import { toast } from '@/services/toast';
import type { Card, CustomField } from '@/types';

interface Props { card: Card; }

const TYPE_ICON: Record<string, string> = {
  text: '📝', number: '#️⃣', url: '🔗', currency: '💰', date: '📅', select: '🎯'
};

function formatValue(field: CustomField, value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'currency') {
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return String(value);
}

export function CardCustomFields({ card }: Props) {
  const customFields = useData(s => s.data.customFields || []);
  const fields = customFields
    .filter(f => f.boardId === card.boardId)
    .sort((a, b) => a.position - b.position);

  if (fields.length === 0) return null;

  return (
    <div className="d-section">
      <div className="d-sec-title">
        <span style={{ fontSize: 14 }}>🏷️</span>
        Custom Fields
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fields.map(f => (
          <CFInput key={f.id} field={f} card={card} />
        ))}
      </div>
    </div>
  );
}

function CFInput({ field, card }: { field: CustomField; card: Card }) {
  const initial = card.customValues?.[field.id];
  const [local, setLocal] = useState<string>(initial === undefined ? '' : String(initial));

  const commit = (val: string) => {
    if (field.type === 'number' || field.type === 'currency') {
      if (val === '') setCardCustomValue(card.id, field.id, null);
      else {
        const n = Number(val.replace(',', '.'));
        if (isNaN(n)) { toast.error('Valor inválido'); return; }
        setCardCustomValue(card.id, field.id, n);
      }
    } else {
      setCardCustomValue(card.id, field.id, val.trim() || null);
    }
  };

  const onBlur = () => commit(local);
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
  };

  const copyVal = async () => {
    if (!local) return;
    await navigator.clipboard.writeText(local);
    toast.success('Copiado', { durationMs: 1500 });
  };
  const openVal = () => {
    if (!local) return;
    let url = local.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    window.walkersAPI.openExternal(url);
  };

  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{TYPE_ICON[field.type]}</span>
        <span>{field.name}</span>
      </div>
      {field.type === 'select' && field.options ? (
        <select
          className="side-sel"
          value={local}
          onChange={(e) => { setLocal(e.target.value); commit(e.target.value); }}
        >
          <option value="">— selecionar —</option>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'date' ? (
        <input
          type="date"
          className="side-inp"
          value={local}
          onChange={(e) => { setLocal(e.target.value); commit(e.target.value); }}
        />
      ) : field.type === 'url' ? (
        <div className="cf-input-row">
          <input
            className="finput"
            placeholder="https://…"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onEnter}
          />
          {local && <button className="cf-icon-btn" onClick={copyVal} title="Copiar">📋</button>}
          {local && <button className="cf-icon-btn" onClick={openVal} title="Abrir no navegador">↗</button>}
        </div>
      ) : (
        <div className="cf-input-row">
          <input
            className="finput"
            type={field.type === 'number' || field.type === 'currency' ? 'text' : 'text'}
            placeholder={
              field.type === 'currency' ? 'Ex: 1500,00 (R$)' :
              field.type === 'number'   ? 'Ex: 42' :
              ''
            }
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onEnter}
          />
          {field.type !== 'number' && field.type !== 'currency' && local && (
            <button className="cf-icon-btn" onClick={copyVal} title="Copiar">📋</button>
          )}
        </div>
      )}
    </div>
  );
}

export function CardCustomFieldChips({ card }: Props) {
  const customFields = useData(s => s.data.customFields || []);
  const fields = customFields
    .filter(f => f.boardId === card.boardId && f.showOnCard)
    .sort((a, b) => a.position - b.position);
  if (fields.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
      {fields.map(f => {
        const val = card.customValues?.[f.id];
        if (val === undefined || val === null || val === '') return null;
        return (
          <span key={f.id} className="cf-card-chip" title={`${f.name}: ${formatValue(f, val)}`}>
            <span>{TYPE_ICON[f.type]}</span>
            <span>{formatValue(f, val)}</span>
          </span>
        );
      })}
    </div>
  );
}

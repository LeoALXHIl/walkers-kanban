import { memo, useState, useRef, useEffect } from 'react';
import type { Card as CardType, Platform } from '@/types';
import { useData, updateCard, togglePinCard, duplicateCard, archiveCard, snoozeCard, moveCard, toggleStarCard } from '@/store/data';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { useUI } from '@/store/ui';
import { PLAT_LABEL, PLAT_CLASS, PLAT_ICON_HTML, PRIO_LABEL, PRIO_CLASS, TrashIcon, CalIcon, SubIcon, ChatIcon } from '@/services/icons';
import { dueInfo, fmt } from '@/services/storage';
import { timeSince } from '@/services/time';
import { pickHashColor } from '@/services/colors';
import { toast } from '@/services/toast';
import { usePermissions } from '@/services/permissions';
import { CardCustomFieldChips } from './CardCustomFields';
import { Lightbox } from './Lightbox';

interface Props {
  card: CardType;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export const CardItem = memo(function CardItem({ card, onDragStart, onDragEnd }: Props) {
  const tags = useData(s => s.data.tags);
  const askDelCard = useUI(s => s.askDelCard);
  const openDetail = useUI(s => s.openDetail);
  const setPlat = useUI(s => s.setPlat);
  const setQ = useUI(s => s.setQ);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(card.name);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const cols = useData(s => s.data.cols);
  const selectedIds = useUI(s => s.selectedCardIds);
  const toggleSelection = useUI(s => s.toggleCardSelection);
  const isSelected = selectedIds.includes(card.id);
  const { canEdit } = usePermissions();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(card.name); }, [card.name]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const [pc, pl] = PRIO_CLASS[card.prio] ? [PRIO_CLASS[card.prio], PRIO_LABEL[card.prio]] : ['bmed', 'Média'];
  const di = dueInfo(card.due);
  const subT = card.subtasks?.length || 0;
  const subD = (card.subtasks || []).filter(s => s.done).length;

  // DV-1: Heatmap — calcula "calor" do card baseado na última interação
  const lastTouched = Math.max(
    card.ts || 0,
    ...((card.comments || []).map(c => c.ts || 0))
  );
  const daysSince = lastTouched ? Math.floor((Date.now() - lastTouched) / 86400000) : 999;
  const heatClass = daysSince === 0 ? ' heat-hot'
                  : daysSince <= 2 ? ' heat-warm'
                  : daysSince > 30 ? ' heat-ice'
                  : daysSince > 7  ? ' heat-cold'
                  : '';
  const cardTags = (card.tagIds || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as { id: string; name: string; color: string }[];

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== card.name) {
      updateCard(card.id, { name: trimmed });
    } else {
      setName(card.name);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setName(card.name);
    setEditing(false);
  };

  const onTagClick = (tagName: string) => {
    setQ(tagName);
    toast.info(`Filtrando por "${tagName}"`, { icon: '🔍', durationMs: 2000 });
  };

  const onPlatClick = (p: Platform) => {
    setPlat(p);
    toast.info(`Filtrando por ${PLAT_LABEL[p]}`, { icon: '🔍', durationMs: 2000 });
  };

  const onAssigneeClick = (name: string) => {
    setQ(name);
    toast.info(`Filtrando por "${name}"`, { icon: '🔍', durationMs: 2000 });
  };

  const onDuplicate = () => {
    const newId = duplicateCard(card.id);
    if (newId) {
      toast.success(`Card duplicado`, { icon: '📋', durationMs: 2000 });
    }
  };

  const onTogglePin = () => {
    togglePinCard(card.id);
    toast.info(card.pinned ? 'Card desafixado' : 'Card fixado no topo', { icon: card.pinned ? '📍' : '⭐', durationMs: 1800 });
  };

  return (
    <div
      className={`card prio-${card.prio || 'med'}${card.pinned ? ' is-pinned' : ''}${isSelected ? ' is-selected' : ''}${heatClass}`}
      style={{ ['--card-color' as any]: card.color || '#7c5cfc' }}
      draggable={!editing && canEdit}
      onDragStart={(e) => { if (editing || !canEdit) return; e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart(card.id); e.currentTarget.classList.add('dragging'); }}
      onDragEnd={(e) => { e.currentTarget.classList.remove('dragging'); onDragEnd(); }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      onClick={(e) => {
        if (editing) return;
        if ((e.target as HTMLElement).closest('.card-btn, .card-name-edit, .card-tag, .card-plat .badge, .card-assignee')) return;
        // UX-3: Shift+click toggles selection instead of opening detail
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.stopPropagation();
          toggleSelection(card.id);
          return;
        }
        openDetail(card.id);
      }}
    >
      {card.pinned && <div className="card-pin-flag" title="Fixado no topo">📌</div>}

      <button
        className={`card-star${card.starred ? ' starred' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggleStarCard(card.id); }}
        title={card.starred ? 'Desfavoritar' : 'Favoritar (F)'}
      >★</button>

      {card.coverUrl && (
        <div
          className="card-cover"
          style={{ backgroundImage: `url("${card.coverUrl}")` }}
          onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
        />
      )}
      {lightboxOpen && card.coverUrl && (
        <Lightbox url={card.coverUrl} alt={card.name} onClose={() => setLightboxOpen(false)} />
      )}

      <div className="card-top">
        {editing ? (
          <input
            ref={inputRef}
            className="card-name-edit"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); saveName(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="card-name" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            {card.name}
          </div>
        )}
        {canEdit && (
          <div className="card-acts">
            <button className="card-btn" title={card.pinned ? 'Desafixar' : 'Fixar no topo'} onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
              {card.pinned ? '⭐' : '☆'}
            </button>
            <button className="card-btn" title="Duplicar" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>📋</button>
            <button className="card-btn" title="Arquivar / Excluir" onClick={(e) => { e.stopPropagation(); askDelCard(card.id); }}>
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {cardTags.length > 0 && (
        <div className="card-tags">
          {cardTags.map(t => (
            <span
              key={t.id}
              className="card-tag"
              style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44`, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onTagClick(t.name); }}
              title={`Filtrar por "${t.name}"`}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {(card.plat || []).length > 0 && (
        <div className="card-plat">
          {card.plat.map(p => (
            <span
              key={p}
              className={`badge ${PLAT_CLASS[p]}`}
              onClick={(e) => { e.stopPropagation(); onPlatClick(p); }}
              style={{ cursor: 'pointer' }}
              title={`Filtrar por ${PLAT_LABEL[p]}`}
            >
              <span dangerouslySetInnerHTML={{ __html: PLAT_ICON_HTML[p] }} />
              {PLAT_LABEL[p]}
            </span>
          ))}
        </div>
      )}

      {card.note && <div className="card-note">{card.note}</div>}

      <CardCustomFieldChips card={card} />

      <div className="card-meta">
        <span
          className={`badge ${pc} prio-toggle`}
          onClick={(e) => {
            e.stopPropagation();
            const next = card.prio === 'high' ? 'med' : card.prio === 'med' ? 'low' : 'high';
            updateCard(card.id, { prio: next });
            toast.info(`Prioridade: ${next === 'high' ? '🔴 Alta' : next === 'med' ? '🟡 Média' : '🟢 Baixa'}`, { durationMs: 1500 });
          }}
          title="Clique pra alternar prioridade"
          style={{ cursor: 'pointer' }}
        >{pl}</span>
        {di && (
          <span className={`card-due ${di.cls}`}>
            <CalIcon />
            {di.label}
          </span>
        )}
        {subT > 0 && (
          <span className="card-sub">
            <SubIcon />
            {subD}/{subT}
          </span>
        )}
        {(card.comments || []).length > 0 && (
          <span className="card-sub">
            <ChatIcon />
            {card.comments.length}
          </span>
        )}
      </div>

      {subT > 0 && (
        <div className="card-progress">
          <div className="card-progress-fill" style={{ width: `${Math.round((subD / subT) * 100)}%` }} />
        </div>
      )}

      <div className="card-footer">
        {card.assignee ? (
          <span
            className="card-assignee"
            onClick={(e) => { e.stopPropagation(); onAssigneeClick(card.assignee!); }}
            style={{ cursor: 'pointer' }}
            title={`Filtrar por "${card.assignee}"`}
          >
            <span className="card-avatar" style={{ background: pickHashColor(card.assignee) }}>
              {card.assignee.slice(0, 2).toUpperCase()}
            </span>
            {card.assignee}
          </span>
        ) : <span />}
        <span className="card-date" title={fmt(card.ts || Date.now())}>{timeSince(card.ts || Date.now())}</span>
      </div>

      {ctxMenu && (() => {
        const otherCols = cols.filter(c => c.id !== card.cid && (!c.boardId || c.boardId === useData.getState().data.activeBoardId));
        const items: MenuItem[] = [
          { label: 'Abrir', icon: '👁', onClick: () => openDetail(card.id) },
          { label: 'Editar nome', icon: '✏️', onClick: () => setEditing(true) },
          { label: 'Duplicar', icon: '📋', onClick: onDuplicate },
          { label: card.pinned ? 'Desafixar' : 'Fixar no topo', icon: card.pinned ? '📍' : '⭐', onClick: onTogglePin },
          { divider: true, label: '' },
          { label: 'Prioridade Alta', icon: '🔴', onClick: () => updateCard(card.id, { prio: 'high' }), disabled: card.prio === 'high' },
          { label: 'Prioridade Média', icon: '🟡', onClick: () => updateCard(card.id, { prio: 'med' }), disabled: card.prio === 'med' },
          { label: 'Prioridade Baixa', icon: '🟢', onClick: () => updateCard(card.id, { prio: 'low' }), disabled: card.prio === 'low' },
          { divider: true, label: '' },
          ...otherCols.slice(0, 5).map(c => ({
            label: `Mover pra "${c.name}"`,
            icon: '📂',
            onClick: () => moveCard(card.id, c.id)
          })),
          { divider: true, label: '' },
          { label: 'Snooze 1 dia', icon: '😴', onClick: () => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9,0,0,0); snoozeCard(card.id, t.getTime()); } },
          { label: 'Snooze 1 semana', icon: '💤', onClick: () => { const t = new Date(); t.setDate(t.getDate() + 7); t.setHours(9,0,0,0); snoozeCard(card.id, t.getTime()); } },
          { label: 'Arquivar', icon: '📦', onClick: () => archiveCard(card.id, true) },
          { label: 'Excluir', icon: '🗑️', danger: true, onClick: () => askDelCard(card.id) }
        ];
        return <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={items} onClose={() => setCtxMenu(null)} />;
      })()}
    </div>
  );
});

import { useState, useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { PLAT_LABEL, PRIO_LABEL } from '@/services/icons';
import { getPresetsForBoard, addPreset, deletePreset, type FilterPreset } from '@/services/filterPresets';
import { quickPrompt } from '@/services/quickPrompt';
import { toast } from '@/services/toast';

export function FilterChips() {
  const q = useUI(s => s.q);
  const plat = useUI(s => s.plat);
  const prio = useUI(s => s.prio);
  const setQ = useUI(s => s.setQ);
  const setPlat = useUI(s => s.setPlat);
  const setPrio = useUI(s => s.setPrio);
  const activeBoardId = useData(s => s.data.activeBoardId);

  const [presets, setPresets] = useState<FilterPreset[]>([]);
  useEffect(() => {
    setPresets(getPresetsForBoard(activeBoardId));
  }, [activeBoardId, q, plat, prio]);

  const hasAny = !!(q || plat || prio);

  const applyPreset = (p: FilterPreset) => {
    setQ(p.q || '');
    setPlat((p.plat || '') as any);
    setPrio((p.prio || '') as any);
    toast.info(`Filtro "${p.name}" aplicado`, { icon: p.emoji || '🔖', durationMs: 1800 });
  };

  const saveCurrent = async () => {
    if (!hasAny || !activeBoardId) { toast.error('Defina algum filtro primeiro'); return; }
    const name = await quickPrompt({
      title: 'Salvar filtro como preset',
      message: 'Esse nome aparece como chip clicável no topo. Você pode aplicar de novo a qualquer momento.',
      placeholder: 'Ex: VIP atrasados, Magazord ativos',
      defaultValue: q ? `Busca: ${q}` : 'Meu filtro',
      okLabel: 'Próximo'
    });
    if (!name || !name.trim()) return;
    const emoji = await quickPrompt({
      title: 'Emoji do preset',
      placeholder: '🔖 🔥 ⭐ 🎯',
      defaultValue: '🔖',
      okLabel: 'Salvar'
    });
    const finalEmoji = emoji || '🔖';
    const preset = addPreset({ name: name.trim(), emoji: finalEmoji, boardId: activeBoardId, q, plat: plat as any, prio: prio as any });
    setPresets(p => [...p, preset]);
    toast.success(`Filtro "${name}" salvo`, { icon: finalEmoji });
  };

  const removePreset = (id: string) => {
    deletePreset(id);
    setPresets(p => p.filter(x => x.id !== id));
  };

  if (!hasAny && presets.length === 0) return null;

  return (
    <div className="filter-chips">
      {hasAny && <span className="filter-chips-label">Ativos:</span>}
      {q && (
        <button className="filter-chip" onClick={() => setQ('')} title="Remover filtro">
          🔍 "{q}" <span className="filter-chip-x">×</span>
        </button>
      )}
      {plat && (
        <button className="filter-chip" onClick={() => setPlat('')} title="Remover filtro">
          {PLAT_LABEL[plat]} <span className="filter-chip-x">×</span>
        </button>
      )}
      {prio && (
        <button className="filter-chip" onClick={() => setPrio('')} title="Remover filtro">
          {PRIO_LABEL[prio]} prioridade <span className="filter-chip-x">×</span>
        </button>
      )}
      {hasAny && (
        <>
          <button className="filter-chip filter-chip-clear" onClick={() => { setQ(''); setPlat(''); setPrio(''); }}>Limpar tudo</button>
          <button className="filter-chip filter-chip-save" onClick={saveCurrent} title="Salvar combinação atual de filtros">💾 Salvar como…</button>
        </>
      )}
      {presets.length > 0 && (
        <>
          <span className="filter-chips-label" style={{ marginLeft: hasAny ? 12 : 0 }}>Presets:</span>
          {presets.map(p => (
            <button
              key={p.id}
              className="filter-chip filter-chip-preset"
              onClick={() => applyPreset(p)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (confirm(`Excluir o preset "${p.name}"?`)) removePreset(p.id);
              }}
              title={`Click pra aplicar · Botão direito pra excluir`}
            >
              {p.emoji || '🔖'} {p.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

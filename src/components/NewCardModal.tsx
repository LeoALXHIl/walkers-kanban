import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useData, addCard, createCardFromTemplate, updateCard } from '@/store/data';
import { useNotifications } from '@/store/notifications';
import { allClients } from '@/services/clients';
import { CARD_COLORS } from '@/services/colors';
import { genId } from '@/services/storage';
import { PLAT_LIST, PLAT_LABEL, PLAT_ICON_HTML } from '@/services/icons';
import { toast } from '@/services/toast';
import type { Platform, Priority } from '@/types';

export function NewCardModal() {
  const open = useUI(s => s.newCardOpen);
  const defaultCol = useUI(s => s.newCardCol);
  const seed = useUI(s => s.newCardSeed);
  const close = useUI(s => s.closeNewCard);
  const openDetail = useUI(s => s.openDetail);
  const allCols = useData(s => s.data.cols);
  const activeBoardId = useData(s => s.data.activeBoardId);
  // useMemo prevents a new array on every render — otherwise the form-reset useEffect
  // would fire on each keystroke (cols reference changes → effect re-runs → state resets).
  const cols = useMemo(
    () => allCols.filter(c => !c.boardId || c.boardId === activeBoardId),
    [allCols, activeBoardId]
  );
  // Use raw selector + useMemo so reference is stable (avoids re-render storms when data.templates is undefined briefly)
  const rawTemplates = useData(s => s.data.templates);
  const templates = useMemo(() => rawTemplates || [], [rawTemplates]);
  const addNotif = useNotifications(s => s.add);

  const [name, setName] = useState('');
  const [cid, setCid] = useState('');
  const [plat, setPlat] = useState<Platform[]>([]);
  const [prio, setPrio] = useState<Priority>('med');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [note, setNote] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Form-reset effect — only fires when the modal opens. Reading seed/defaultCol/cols inside
  // the effect (without putting them in deps) is safe because they're set BEFORE openNewCard()
  // triggers the open=true transition. Deps kept to [open] only to prevent any state reset while typing.
  useEffect(() => {
    if (!open) return;
    // Read fresh values directly from stores at the moment of opening
    const { newCardSeed: s, newCardCol: dc } = useUI.getState();
    const stateData = useData.getState().data;
    const colsNow = stateData.cols.filter(c => !c.boardId || c.boardId === stateData.activeBoardId);
    setName(s?.name || '');
    setNote(s?.note || '');
    setPlat(s?.plat || []);
    setPrio(s?.prio || 'med');
    setColor(CARD_COLORS[0]);
    setCid(dc || colsNow[0]?.id || '');
    setSelectedTemplateId('');
    setNameErr(false);
    setTimeout(() => nameRef.current?.focus(), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When user picks a template, pre-fill the form fields. Subtasks + tags are applied on save.
  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return; // back to blank
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const d = template.defaults;
    // Pre-fill — keep current name if user already typed it, else use template's (with {{cliente}} placeholder kept for them to replace)
    if (d.name && !name.trim()) setName(d.name);
    if (d.note) setNote(d.note);
    if (d.plat && d.plat.length) setPlat(d.plat);
    if (d.prio) setPrio(d.prio);
    if (d.color) setColor(d.color);
    // Use template's default column ONLY if it's still part of the current board
    if (d.cid && cols.some(c => c.id === d.cid)) setCid(d.cid);
    toast.info(`Template "${template.name}" aplicado — edita o que quiser e clica em Criar`, { icon: template.emoji || '📋', durationMs: 3000 });
    nameRef.current?.focus();
  };

  if (!open) return null;

  const togglePlat = (p: Platform) => {
    setPlat(cur => cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p]);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameErr(true); setTimeout(() => setNameErr(false), 1000);
      toast.error('Coloca o nome do cliente antes de salvar');
      nameRef.current?.focus();
      return;
    }
    if (!cid) {
      // Fallback: pick the first column of the current board if none is selected
      const first = cols[0]?.id;
      if (first) {
        setCid(first);
      } else {
        toast.error('Esse board não tem colunas. Crie uma coluna primeiro.');
        return;
      }
    }
    // Re-read cid after possible fallback set above
    const targetCid = cid || cols[0]?.id || '';
    if (!targetCid) { toast.error('Sem coluna disponível'); return; }

    // If a template was selected, route through createCardFromTemplate so subtasks + tags get applied.
    // We use the typed name as the client name; the template's {{cliente}} placeholder gets replaced.
    if (selectedTemplateId) {
      const card = createCardFromTemplate(selectedTemplateId, trimmed, targetCid);
      if (card) {
        // Apply the user's edits on top of the template-created card.
        // Card's name from template may still contain "{{cliente}}" or be the raw template name —
        // override with whatever the user typed.
        updateCard(card.id, {
          name: trimmed,
          plat,
          prio,
          color,
          note: note.trim() || card.note
        });
        const col = cols.find(c => c.id === targetCid);
        addNotif({ type: 'create', icon: '✨', title: `Card criado: ${trimmed}`, sub: `Em ${col?.name || '—'} · via template`, ts: Date.now(), cardId: card.id });
        toast.success(`Card "${trimmed}" criado com template`, { icon: '✨' });
        close();
        setTimeout(() => openDetail(card.id), 150);
        return;
      } else {
        toast.error('Falha ao aplicar template — criando card normal.');
      }
    }

    // Plain creation (no template)
    const newId = genId();
    addCard({
      id: newId,
      cid: targetCid,
      name: trimmed,
      plat,
      prio,
      color,
      note: note.trim(),
      desc: '',
      assignee: null,
      due: seed?.due || null,
      tagIds: [],
      subtasks: [],
      attachments: [],
      comments: [],
      ts: Date.now()
    });
    const col = cols.find(c => c.id === targetCid);
    addNotif({ type: 'create', icon: '✨', title: `Card criado: ${trimmed}`, sub: `Em ${col?.name || '—'}`, ts: Date.now(), cardId: newId });
    toast.success(`Card "${trimmed}" criado em ${col?.name || '—'}`, { icon: '✨' });
    close();
    setTimeout(() => openDetail(newId), 150);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal">
        <h2>Novo card</h2>
        {templates.length > 0 && (
          <div className="frow">
            <label className="flabel">Usar template (opcional)</label>
            <select
              className="fsel"
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">— Em branco —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.emoji || '📋'} {t.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="frow">
          <label className="flabel">Nome do cliente</label>
          <input
            ref={nameRef}
            className="finput"
            placeholder="Ex: Loja da Maria…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={nameErr ? { borderColor: 'var(--red)' } : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            list="clientNamesList"
            autoComplete="off"
          />
          <datalist id="clientNamesList">
            {allClients(useData.getState().data).filter(c => !c.profile?.archived).map(c => (
              <option key={c.key} value={c.displayName} />
            ))}
          </datalist>
        </div>
        <div className="frow">
          <label className="flabel">Coluna</label>
          <select className="fsel" value={cid} onChange={(e) => setCid(e.target.value)}>
            {cols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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
        <div className="frow">
          <label className="flabel">Prioridade</label>
          <select className="fsel" value={prio} onChange={(e) => setPrio(e.target.value as Priority)}>
            <option value="med">Média</option>
            <option value="high">Alta</option>
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
        <div className="frow">
          <label className="flabel">Observação rápida</label>
          <textarea className="ftxt" placeholder="Detalhe inicial…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Criar card</button>
        </div>
      </div>
    </div>
  );
}

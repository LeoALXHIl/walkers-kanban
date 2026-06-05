import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/store/auth';

// Tour guiado (Sprint 3). Spotlight + tooltip posicionados em runtime via
// getBoundingClientRect (sem coordenadas fixas), então sobrevive a mudanças de
// layout. Passos cujo alvo não existe são pulados automaticamente.

type Step = { sel: string; title: string; body: string };

const STEPS: Step[] = [
  { sel: '[data-tour="boards"]', title: 'Seus boards', body: 'Cada cliente ou projeto pode ter o próprio quadro. Troque entre eles por aqui.' },
  { sel: '[data-tour="kanban"]', title: 'O quadro', body: 'Arraste os cards entre colunas conforme cada cliente avança — do lead à entrega.' },
  { sel: '[data-tour="clients"]', title: 'Clientes', body: 'Cadastre quem você atende e veja tudo de cada um reunido num lugar só.' },
  { sel: '[data-tour="calendar"]', title: 'Agenda', body: 'Conecte o Google Calendar e acompanhe seus compromissos sem sair do app.' },
  { sel: '[data-tour="integrations"]', title: 'Portal do cliente', body: 'Compartilhe um portal de acompanhamento white-label e configure integrações.' }
];

const doneKey = (uid?: string | null) => `walkers.tour.done.${uid || 'anon'}`;

export function startTour() {
  window.dispatchEvent(new CustomEvent('walkers:tour'));
}

export function tourDone(uid?: string | null): boolean {
  try { return localStorage.getItem(doneKey(uid)) === '1'; } catch { return false; }
}

export function GuidedTour() {
  const uid = useAuth((s) => s.user?.uid);
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    try { localStorage.setItem(doneKey(uid), '1'); } catch {}
  }, [uid]);

  // Início via evento global (disparado pelo WelcomeModal ou botão "Refazer tour").
  useEffect(() => {
    const h = () => { setI(0); setActive(true); };
    window.addEventListener('walkers:tour', h);
    return () => window.removeEventListener('walkers:tour', h);
  }, []);

  // Resolve o alvo do passo atual; pula passos sem alvo na tela.
  useEffect(() => {
    if (!active) return;
    let idx = i;
    while (idx < STEPS.length) {
      const el = document.querySelector(STEPS[idx].sel) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
        if (idx !== i) setI(idx);
        return;
      }
      idx++;
    }
    finish();
  }, [active, i, finish]);

  // Reposiciona ao redimensionar a janela.
  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      const el = document.querySelector(STEPS[i].sel) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, i]);

  if (!active || !rect) return null;

  const step = STEPS[i];
  const last = i >= STEPS.length - 1;

  // Tooltip à direita do alvo (sidebar fica à esquerda); cai pra esquerda se faltar espaço.
  const pad = 10;
  const tipW = 280;
  let left = rect.right + pad;
  if (left + tipW > window.innerWidth) left = rect.left - tipW - pad;
  if (left < pad) left = pad;
  let top = Math.min(rect.top, window.innerHeight - 180);
  if (top < pad) top = pad;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <div onClick={finish} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          left: rect.left - 4, top: rect.top - 4,
          width: rect.width + 8, height: rect.height + 8,
          borderRadius: 10,
          boxShadow: '0 0 0 9999px rgba(0,0,0,.55)',
          border: '2px solid var(--accent, #7c5cfc)',
          pointerEvents: 'none',
          transition: 'all .25s ease'
        }}
      />
      <div
        style={{
          position: 'absolute', left, top, width: tipW,
          background: 'var(--panel, #1a1a24)', color: 'var(--text, #fff)',
          border: '1px solid var(--border, #333)', borderRadius: 12, padding: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,.5)'
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text3, #888)', marginBottom: 6 }}>
          Passo {i + 1} de {STEPS.length}
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{step.title}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text2, #bbb)', lineHeight: 1.5 }}>{step.body}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={finish}>Pular</button>
          <button className="btn btn-primary" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? 'Concluir ✓' : 'Próximo →'}
          </button>
        </div>
      </div>
    </div>
  );
}

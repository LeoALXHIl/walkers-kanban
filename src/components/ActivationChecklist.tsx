import { useEffect, useRef, useState } from 'react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { confetti } from '@/services/confetti';
import { startTour } from '@/components/GuidedTour';
import { toast } from '@/services/toast';

// Checklist de ativação (Sprint 3). Guia o usuário novo até o "aha".
// - Detecta cada passo a partir do estado real (não há schema novo).
// - Some quando TUDO está concluído → usuário veterano nunca vê o widget.
// - Dispensável; a escolha persiste por usuário no localStorage.

type Step = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  cta: string;
  action: () => void;
};

const dismissKey = (uid?: string | null) => `walkers.onboarding.dismissed.${uid || 'anon'}`;

export function ActivationChecklist() {
  const data = useData((s) => s.data);
  const uid = useAuth((s) => s.user?.uid);
  const googleToken = useAuth((s) => s.googleAccessToken);
  const setView = useUI((s) => s.setView);
  const openNewCard = useUI((s) => s.openNewCard);

  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(true);
  const prevDone = useRef<number | null>(null);

  // Recarrega o estado de "dispensado" quando o usuário muda.
  useEffect(() => {
    setDismissed(typeof localStorage !== 'undefined' && localStorage.getItem(dismissKey(uid)) === '1');
  }, [uid]);

  const steps: Step[] = [
    {
      id: 'card',
      label: 'Criar seu primeiro card',
      hint: 'Adicione uma tarefa ou um cliente ao quadro.',
      done: (data.cards?.length || 0) > 0,
      cta: 'Criar card',
      action: () => openNewCard()
    },
    {
      id: 'client',
      label: 'Cadastrar um cliente',
      hint: 'Adicione telefone/e-mail a um cliente na aba Clientes.',
      done: Object.keys(data.clientProfiles || {}).length > 0,
      cta: 'Ir para Clientes',
      action: () => setView('clients')
    },
    {
      id: 'google',
      label: 'Conectar o Google Calendar',
      hint: 'Veja seus compromissos dentro do Walkers.',
      done: !!googleToken,
      cta: 'Conectar',
      action: () => setView('integrations')
    },
    {
      id: 'goal',
      label: 'Definir uma meta',
      hint: 'Acompanhe um objetivo do seu negócio.',
      done: (data.goals?.length || 0) > 0,
      cta: 'Criar meta',
      action: () => setView('goals')
    }
  ];

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === total;

  // Comemora UMA vez ao concluir o último passo nesta sessão, depois o widget some.
  useEffect(() => {
    if (prevDone.current !== null && prevDone.current < total && doneCount === total) {
      confetti();
      toast.success('Tudo pronto! Você dominou o básico do Walkers 🎉', { durationMs: 4000 });
    }
    prevDone.current = doneCount;
  }, [doneCount, total]);

  // Veterano (tudo feito) ou dispensado → não renderiza.
  if (dismissed || allDone || !uid) return null;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(uid), '1'); } catch {}
    setDismissed(true);
  };

  const pct = Math.round((doneCount / total) * 100);
  const R = 13;
  const C = 2 * Math.PI * R;

  // Anel de progresso reutilizado nos dois estados (recolhido/expandido).
  const ring = (
    <svg width="34" height="34" viewBox="0 0 34 34" style={{ flex: '0 0 auto' }}>
      <circle cx="17" cy="17" r={R} fill="none" stroke="var(--border, #2c2c3a)" strokeWidth="3" />
      <circle
        cx="17" cy="17" r={R} fill="none" stroke="var(--accent, #7c3aed)" strokeWidth="3"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * doneCount) / total}
        transform="rotate(-90 17 17)" style={{ transition: 'stroke-dashoffset .4s ease' }}
      />
      <text x="17" y="21" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text, #e8e8f0)">
        {doneCount}/{total}
      </text>
    </svg>
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Primeiros passos"
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 1400,
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 14px 8px 8px', borderRadius: 999,
          background: 'var(--bg2, #1b1b27)', border: '1px solid var(--border, #2c2c3a)',
          boxShadow: '0 6px 20px rgba(0,0,0,.3)', color: 'var(--text, #e8e8f0)',
          cursor: 'pointer', fontSize: 13, fontWeight: 600
        }}
      >
        {ring}
        Primeiros passos
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 1400, width: 320,
        background: 'var(--bg2, #1b1b27)', border: '1px solid var(--border, #2c2c3a)',
        borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.35)', overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 14px 10px' }}>
        {ring}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #e8e8f0)' }}>Primeiros passos</div>
          <div style={{ fontSize: 12, color: 'var(--text2, #9b9bb0)' }}>{pct}% concluído</div>
        </div>
        <button
          onClick={() => setOpen(false)} aria-label="Recolher"
          style={{ background: 'transparent', border: 'none', color: 'var(--text2, #9b9bb0)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
        >
          –
        </button>
      </div>

      <div style={{ padding: '0 8px 8px' }}>
        {steps.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px',
              borderRadius: 9, opacity: s.done ? 0.6 : 1
            }}
          >
            <span
              style={{
                flex: '0 0 auto', width: 20, height: 20, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? 'var(--accent, #7c3aed)' : 'transparent',
                border: s.done ? 'none' : '2px solid var(--border, #44445a)',
                color: '#fff', fontSize: 12
              }}
            >
              {s.done ? '✓' : ''}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #e8e8f0)', textDecoration: s.done ? 'line-through' : 'none' }}>
                {s.label}
              </div>
              {!s.done && <div style={{ fontSize: 11, color: 'var(--text2, #9b9bb0)', marginTop: 1 }}>{s.hint}</div>}
            </div>
            {!s.done && (
              <button
                onClick={s.action}
                style={{
                  flex: '0 0 auto', padding: '5px 10px', borderRadius: 7, border: 'none',
                  background: 'var(--accent, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {s.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid var(--border, #2c2c3a)' }}>
        <button
          onClick={() => startTour()}
          style={{
            flex: 1, padding: '9px', border: 'none', borderRight: '1px solid var(--border, #2c2c3a)',
            background: 'transparent', color: 'var(--text2, #9b9bb0)', fontSize: 12, cursor: 'pointer'
          }}
        >
          🧭 Refazer tour
        </button>
        <button
          onClick={dismiss}
          style={{
            flex: 1, padding: '9px', border: 'none',
            background: 'transparent', color: 'var(--text2, #9b9bb0)', fontSize: 12, cursor: 'pointer'
          }}
        >
          Dispensar
        </button>
      </div>
    </div>
  );
}

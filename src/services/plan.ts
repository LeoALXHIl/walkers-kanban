// Plano do usuário (billing MVP sem backend, Sprint 2).
// Fonte de verdade: doc Firestore `plans/{uid}` — gravável SÓ pelo admin
// (rules). O fluxo de assinatura é o checkout hospedado do Mercado Pago
// (link de assinatura); a ativação é manual até o projeto ter Blaze+webhook:
// assinante paga → envia o código de ativação (uid) → admin cria o doc.
import { create } from 'zustand';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export type PlanId = 'free' | 'pro' | 'team';

// Dono do produto: sempre tem tudo liberado e é quem ativa assinantes.
export const ADMIN_UID = 'QAJ08ZLj9nPj5DMjn1j97jLEL102';

// Link de assinatura do Mercado Pago (criar em: mercadopago.com.br →
// Seu negócio → Assinaturas → Criar plano "Walkers Pro" R$39/mês).
// Enquanto vazio, o modal de upgrade cai no contato por e-mail.
export const MP_PRO_LINK = '';

export const CONTACT_EMAIL = 'leoaleixohilario@gmail.com';

export const PLAN_LIMITS: Record<PlanId, { boards: number; whiteLabel: boolean; label: string }> = {
  free: { boards: 1, whiteLabel: false, label: 'Free' },
  pro: { boards: Infinity, whiteLabel: true, label: 'Pro' },
  team: { boards: Infinity, whiteLabel: true, label: 'Team' }
};

interface PlanState {
  plan: PlanId;
  loaded: boolean;
  init: (uid: string) => void;
  teardown: () => void;
}

let unsub: (() => void) | null = null;

export const usePlan = create<PlanState>((set) => ({
  plan: 'free',
  loaded: false,
  init: (uid) => {
    unsub?.();
    if (uid === ADMIN_UID) { set({ plan: 'team', loaded: true }); return; }
    unsub = onSnapshot(
      doc(db, 'plans', uid),
      (snap) => {
        const p = snap.data()?.plan;
        set({ plan: p === 'pro' || p === 'team' ? p : 'free', loaded: true });
      },
      () => set({ plan: 'free', loaded: true }) // sem doc/permissão → free
    );
  },
  teardown: () => { unsub?.(); unsub = null; set({ plan: 'free', loaded: false }); }
}));

export function planLimits(plan: PlanId) {
  return PLAN_LIMITS[plan];
}

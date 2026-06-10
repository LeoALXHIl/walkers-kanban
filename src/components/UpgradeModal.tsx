// Modal de upgrade pro plano Pro (billing MVP). Aberto pelos pontos de
// gating (limite de boards, white-label) ou pelo botão da sidebar.
// Checkout = link de assinatura do Mercado Pago; ativação manual via
// código (uid) enviado por e-mail enquanto não há webhook (sem Blaze).
import { create } from 'zustand';
import { useAuth } from '@/store/auth';
import { usePlan, MP_PRO_LINK, CONTACT_EMAIL } from '@/services/plan';
import { toast } from '@/services/toast';

type Reason = 'boards' | 'whitelabel' | 'generic';

export const useUpgrade = create<{ open: boolean; reason: Reason; show: (r?: Reason) => void; hide: () => void }>((set) => ({
  open: false,
  reason: 'generic',
  show: (r = 'generic') => set({ open: true, reason: r }),
  hide: () => set({ open: false })
}));

const REASON_COPY: Record<Reason, string> = {
  boards: 'O plano Free tem 1 board. Desbloqueie boards ilimitados com o Pro.',
  whitelabel: 'O portal 100% com a sua marca (logo, sem "Feito com Walkers") é exclusivo do Pro.',
  generic: 'Desbloqueie todo o potencial do Walkers.'
};

const PRO_FEATURES = [
  '🗂️ Boards ilimitados',
  '🎨 Portal white-label completo (sua marca, sem a nossa)',
  '📅 Google Calendar + Assistente IA',
  '✅ Aprovações e comentários do cliente',
  '⚡ Suporte prioritário'
];

export function UpgradeModal() {
  const open = useUpgrade(s => s.open);
  const reason = useUpgrade(s => s.reason);
  const hide = useUpgrade(s => s.hide);
  const user = useAuth(s => s.user);
  const plan = usePlan(s => s.plan);

  if (!open) return null;

  const uid = user?.uid || '';
  const mailSubject = encodeURIComponent('Walkers Pro — ativação de assinatura');
  const mailBody = encodeURIComponent(
    `Olá! Assinei o Walkers Pro no Mercado Pago.\n\nMeu código de ativação: ${uid}\nMeu e-mail no app: ${user?.email || ''}\n\nPode ativar?`
  );
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${mailBody}`;

  const subscribe = () => {
    if (MP_PRO_LINK) window.walkersAPI.openExternal(MP_PRO_LINK);
    else window.location.href = mailto;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(uid);
      toast.success('Código copiado', { durationMs: 1800 });
    } catch {
      toast.error('Não consegui copiar — selecione manualmente');
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) hide(); }}>
      <div className="modal" role="dialog" aria-label="Fazer upgrade pro plano Pro">
        <h2>✨ Walkers Pro</h2>
        <p>{REASON_COPY[reason]}</p>

        <div className="upg-price">
          <span className="upg-price-value">R$39</span>
          <span className="upg-price-period">/mês · cancele quando quiser</span>
        </div>

        <ul className="upg-feats">
          {PRO_FEATURES.map(f => <li key={f}>{f}</li>)}
        </ul>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} onClick={subscribe}>
          {MP_PRO_LINK ? 'Assinar com Mercado Pago →' : 'Quero assinar — falar com a gente'}
        </button>

        {MP_PRO_LINK && (
          <div className="upg-activate">
            <div className="upg-activate-title">Depois de assinar:</div>
            A ativação é confirmada em até 24h. Agilize enviando seu código de
            ativação pra <a href={mailto}>{CONTACT_EMAIL}</a>:
            <div className="upg-code-row">
              <code className="upg-code">{uid}</code>
              <button className="btn btn-ghost" onClick={copyCode} style={{ fontSize: 11, padding: '5px 10px' }}>Copiar</button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="auth-link" onClick={hide} style={{ fontSize: 12 }}>
            {plan === 'free' ? 'Continuar no Free' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
}

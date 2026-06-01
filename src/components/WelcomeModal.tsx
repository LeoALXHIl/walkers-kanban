import { useState } from 'react';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { seedExampleBoard } from '@/services/exampleBoard';
import { toast } from '@/services/toast';

// Wizard de boas-vindas (Sprint 3). Aparece UMA vez, só pra conta nova
// (sem cards) — veterano nunca vê. Oferece começar com um board de exemplo.
// Auto-controlado (localStorage + estado), sem depender da ui store.

const seenKey = (uid?: string | null) => `walkers.welcome.seen.${uid || 'anon'}`;

export function WelcomeModal() {
  const uid = useAuth((s) => s.user?.uid);
  const cardCount = useData((s) => s.data.cards.length);
  const [closed, setClosed] = useState(false);

  const alreadySeen = typeof localStorage !== 'undefined' && localStorage.getItem(seenKey(uid)) === '1';

  // Só pra usuário logado, conta vazia, ainda não visto e não fechado nesta sessão.
  if (!uid || closed || alreadySeen || cardCount > 0) return null;

  const markSeen = () => {
    try { localStorage.setItem(seenKey(uid), '1'); } catch {}
    setClosed(true);
  };

  const startWithExample = () => {
    const n = seedExampleBoard();
    markSeen();
    if (n > 0) toast.success(`Pronto! ${n} cards de exemplo no seu board. Edite ou apague à vontade.`, { durationMs: 5000 });
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) markSeen(); }}>
      <div className="modal" style={{ width: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 44, lineHeight: 1, margin: '6px 0 10px' }}>👋</div>
        <h2 style={{ marginBottom: 6 }}>Bem-vindo ao Walkers</h2>
        <p style={{ color: 'var(--text2, #9b9bb0)', marginTop: 0 }}>
          O kanban dos consultores de WhatsApp. Organize clientes, tarefas e prazos num só lugar.
        </p>

        <div style={{ textAlign: 'left', margin: '18px auto', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🗂️</span>
            <span style={{ fontSize: 14 }}>Acompanhe cada cliente do lead à entrega no quadro.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <span style={{ fontSize: 14 }}>Conecte o Google Calendar e veja seus compromissos aqui.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤝</span>
            <span style={{ fontSize: 14 }}>Compartilhe um portal de acompanhamento com seu cliente.</span>
          </div>
        </div>

        <div className="mfoot" style={{ justifyContent: 'center', gap: 10 }}>
          <button className="btn btn-ghost" onClick={markSeen}>Começar do zero</button>
          <button className="btn btn-primary" onClick={startWithExample}>✨ Começar com um exemplo</button>
        </div>
      </div>
    </div>
  );
}

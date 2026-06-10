import { useState, type FormEvent } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { AuthCard } from './Login';

// E-mail público de contato (mesmo do rodapé legal). Quando houver número
// comercial de WhatsApp, trocar o mailto por https://wa.me/55XXXXXXXXXXX.
const CONTACT_EMAIL = 'leoaleixohilario@gmail.com';

// Landing de vendas (Sprint 5). É a primeira tela de quem chega deslogado:
// proposta de valor + planos + o card de cadastro embutido. Estilos escopados
// num <style> local (com media queries) pra não tocar no CSS global.

const FEATURES = [
  { icon: '🗂️', title: 'Cada cliente no lugar', body: 'Acompanhe do lead à entrega num quadro visual. Arraste, priorize e nunca perca um follow-up.' },
  { icon: '🤝', title: 'Portal do cliente', body: 'Compartilhe um link white-label onde o cliente vê o progresso, comenta e aprova etapas.' },
  { icon: '📅', title: 'Agenda integrada', body: 'Conecte o Google Calendar e veja seus compromissos sem trocar de aba.' },
  { icon: '🤖', title: 'Assistente com IA', body: 'Crie cards por voz, foto ou texto. A IA organiza pra você em segundos.' },
  { icon: '🔥', title: 'Streaks e metas', body: 'Gamificação que te mantém constante e foco nas metas do seu negócio.' },
  { icon: '📊', title: 'Dashboard e analytics', body: 'Veja gargalos, prazos e produtividade em gráficos claros.' }
];

type Plan = {
  name: string; price: string; period: string; highlight?: boolean;
  tagline: string; features: string[]; cta: string; action: 'signup' | 'waitlist' | 'contact';
};
const PLANS: Plan[] = [
  {
    name: 'Free', price: 'R$0', period: 'pra sempre',
    tagline: 'Pra começar a organizar hoje',
    features: ['Kanban, lista e calendário', 'Clientes ilimitados', 'Portal do cliente', 'App desktop + web (PWA)'],
    cta: 'Começar grátis', action: 'signup'
  },
  {
    name: 'Pro', price: 'R$39', period: '/mês', highlight: true,
    tagline: 'Em breve — preço de fundador garantido',
    features: ['Boards ilimitados', 'Portal white-label completo', 'Google Calendar + IA', 'Aprovações e comentários do cliente', 'Suporte prioritário'],
    cta: 'Entrar na lista do Pro', action: 'waitlist'
  },
  {
    name: 'Team', price: 'R$99', period: '/mês',
    tagline: 'Em breve — pra agência ou equipe',
    features: ['Tudo do Pro', 'Workspace multiusuário', 'Papéis e permissões', 'Relatórios da equipe'],
    cta: 'Falar com a gente', action: 'contact'
  }
];

// Captura de e-mail da lista de espera do Pro. Grava em waitlist/ (create-only
// nas rules) — vira o pipeline de entrevistas pra validar o pricing.
function WaitlistForm({ plan, onDone }: { plan: string; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await addDoc(collection(db, 'waitlist'), { email: email.trim(), plan, ts: Date.now() });
      onDone();
    } catch {
      setErr('Não rolou agora. Tenta de novo em instantes.');
      setBusy(false);
    }
  };
  return (
    <form className="lp-wait-form" onSubmit={submit}>
      <input
        type="email" required value={email} disabled={busy}
        placeholder="seu@email.com" aria-label="Seu e-mail pra lista de espera"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="lp-btn lp-btn-primary" disabled={busy}>
        {busy ? 'Enviando…' : 'Avisar quando lançar'}
      </button>
      {err && <div className="lp-wait-err" role="alert">{err}</div>}
    </form>
  );
}

export function Landing() {
  // null = fechado; 'open' = mostrando form; 'done' = inscrito
  const [waitlist, setWaitlist] = useState<Record<string, 'open' | 'done'>>({});
  const scrollToAuth = () => {
    document.getElementById('entrar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const planAction = (p: Plan) => {
    if (p.action === 'waitlist') setWaitlist(w => ({ ...w, [p.name]: 'open' }));
    else if (p.action === 'contact') window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Walkers — plano ' + p.name)}`;
    else scrollToAuth();
  };

  return (
    <div className="lp">
      <style>{LP_CSS}</style>

      <header className="lp-nav">
        <div className="lp-brand"><span className="lp-logo">W</span> Walkers</div>
        <nav className="lp-nav-links">
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <button className="lp-btn lp-btn-ghost" onClick={scrollToAuth}>Entrar</button>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-badge">✨ Feito pra consultores de WhatsApp</span>
          <h1>O kanban que organiza seus clientes e <span className="lp-grad">fecha mais projetos</span>.</h1>
          <p className="lp-lead">
            Centralize clientes, tarefas, prazos e reuniões num só lugar. Compartilhe um portal
            profissional com cada cliente e passe a impressão de quem tem tudo sob controle.
          </p>
          <div className="lp-hero-cta">
            <button className="lp-btn lp-btn-primary" onClick={scrollToAuth}>Começar grátis →</button>
            <a className="lp-btn lp-btn-ghost" href="#planos">Ver planos</a>
          </div>
          <div className="lp-trust">Grátis pra começar · Sem cartão · Roda no desktop e no navegador</div>
        </div>
        <div className="lp-hero-auth">
          <AuthCard initialMode="signup" />
        </div>
      </section>

      {/* Preview do produto: mockup em CSS do kanban (placeholder até ter
          screenshot real — manter a estrutura e só trocar pelo <img>). */}
      <section className="lp-section lp-preview-wrap" aria-label="Prévia do produto">
        <h2 className="lp-h2">Seu negócio, organizado assim</h2>
        <p className="lp-sub">Quadros por cliente, prazos visíveis e portal de acompanhamento — sem planilha.</p>
        <div className="lp-preview" aria-hidden="true">
          <div className="lp-pv-top"><span /><span /><span /></div>
          <div className="lp-pv-board">
            {([
              { title: 'A iniciar', cards: [{ n: 'Onboarding — Casa M.', tag: 'WhatsApp', due: 'qui' }, { n: 'Proposta — Closet Fit', tag: 'Proposta', due: 'sex' }] },
              { title: 'Em implementação', cards: [{ n: 'Chatbot — Maiu Fit', tag: 'Bot', due: 'hoje', hot: true }, { n: 'Catálogo — Dona Flor', tag: 'E-commerce', due: 'ter' }] },
              { title: 'Aguardando cliente', cards: [{ n: 'Aprovação de fluxo — Wazzu', tag: 'Aprovação', due: '—' }] },
              { title: 'Concluído', cards: [{ n: 'Setup inicial — Bem Beleza', tag: 'Entregue', done: true, due: '✓' }] }
            ] as Array<{ title: string; cards: Array<{ n: string; tag: string; due: string; hot?: boolean; done?: boolean }> }>).map(col => (
              <div className="lp-pv-col" key={col.title}>
                <div className="lp-pv-col-title">{col.title}</div>
                {col.cards.map(c => (
                  <div className={`lp-pv-card${c.done ? ' done' : ''}${c.hot ? ' hot' : ''}`} key={c.n}>
                    <div className="lp-pv-card-name">{c.n}</div>
                    <div className="lp-pv-card-meta"><span className="lp-pv-tag">{c.tag}</span><span>{c.due}</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="recursos">
        <h2 className="lp-h2">Tudo que um consultor precisa, sem planilha</h2>
        <div className="lp-grid">
          {FEATURES.map(f => (
            <div className="lp-feature" key={f.title}>
              <span className="lp-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="planos">
        <h2 className="lp-h2">Planos simples, sem pegadinha</h2>
        <p className="lp-sub">Hoje tudo é grátis. Os planos pagos chegam em breve — quem entrar na lista garante o preço de fundador.</p>
        <div className="lp-plans">
          {PLANS.map(p => (
            <div className={`lp-plan${p.highlight ? ' lp-plan-hi' : ''}`} key={p.name}>
              {p.highlight && <span className="lp-plan-tag">Mais popular</span>}
              <div className="lp-plan-name">{p.name}</div>
              <div className="lp-plan-price">{p.price}<span>{p.period}</span></div>
              <div className="lp-plan-tagline">{p.tagline}</div>
              <ul className="lp-plan-feats">
                {p.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              {waitlist[p.name] === 'done' ? (
                <div className="lp-wait-ok">✓ Você está na lista! Te aviso no lançamento.</div>
              ) : waitlist[p.name] === 'open' ? (
                <WaitlistForm plan={p.name} onDone={() => setWaitlist(w => ({ ...w, [p.name]: 'done' }))} />
              ) : (
                <button className={`lp-btn ${p.highlight ? 'lp-btn-primary' : 'lp-btn-ghost'} lp-plan-cta`} onClick={() => planAction(p)}>{p.cta}</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta-final">
        <h2>Pronto pra organizar seu negócio?</h2>
        <button className="lp-btn lp-btn-primary" onClick={scrollToAuth}>Criar minha conta grátis →</button>
      </section>

      <footer className="lp-footer">
        <div>© {new Date().getFullYear()} Walkers Kanban</div>
        <div className="lp-footer-links">
          <a href="https://walkerskambam.web.app/sobre" target="_blank" rel="noopener noreferrer">Sobre</a>
          <a href="https://walkerskambam.web.app/termos" target="_blank" rel="noopener noreferrer">Termos</a>
          <a href="https://walkerskambam.web.app/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a>
          <a href="https://walkerskambam.web.app/lgpd" target="_blank" rel="noopener noreferrer">LGPD</a>
        </div>
      </footer>
    </div>
  );
}

const LP_CSS = `
.lp { flex: 1; width: 100%; min-width: 0; min-height: 100vh; overflow-y: auto; overflow-x: hidden; background: radial-gradient(ellipse at top, #1a1430 0%, #0d0e11 55%); color: #e8e8f0; font-family: 'Geist', sans-serif; }
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp a { color: inherit; text-decoration: none; }
.lp-nav { display: flex; align-items: center; justify-content: space-between; max-width: 1100px; margin: 0 auto; padding: 20px 24px; }
.lp-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; }
.lp-logo { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, #7c5cfc, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 15px; color: #fff; }
.lp-nav-links { display: flex; align-items: center; gap: 22px; font-size: 14px; color: #b8b8c8; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: transform .12s, box-shadow .12s, background .15s; }
.lp-btn:hover { transform: translateY(-1px); }
.lp-btn-primary { background: linear-gradient(135deg, #7c5cfc, #ec4899); color: #fff; box-shadow: 0 8px 24px rgba(124,92,252,.35); }
.lp-btn-ghost { background: rgba(255,255,255,.06); color: #e8e8f0; border-color: rgba(255,255,255,.12); }
.lp-hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px; align-items: center; max-width: 1100px; margin: 0 auto; padding: 40px 24px 64px; }
.lp-hero-copy { min-width: 0; }
.lp-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(124,92,252,.15); border: 1px solid rgba(124,92,252,.35); font-size: 12px; color: #c4b5fd; margin-bottom: 18px; }
.lp-hero-copy h1 { font-size: 42px; line-height: 1.1; font-weight: 800; margin: 0 0 18px; letter-spacing: -.02em; }
.lp-grad { background: linear-gradient(135deg, #a78bfa, #ec4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lp-lead { font-size: 16px; line-height: 1.6; color: #b8b8c8; margin: 0 0 24px; max-width: 520px; }
.lp-hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.lp-trust { font-size: 12px; color: #a9a9bc; }
.lp-preview-wrap { padding-bottom: 24px; }
.lp-preview { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 14px; box-shadow: 0 24px 80px rgba(0,0,0,.45); max-width: 980px; margin: 0 auto; }
.lp-pv-top { display: flex; gap: 6px; padding: 2px 4px 12px; }
.lp-pv-top span { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.14); }
.lp-pv-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.lp-pv-col { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); border-radius: 12px; padding: 10px; min-width: 0; }
.lp-pv-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #a9a9bc; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lp-pv-card { background: rgba(20,18,34,.85); border: 1px solid rgba(255,255,255,.09); border-radius: 9px; padding: 9px 10px; margin-bottom: 8px; }
.lp-pv-card.hot { border-color: rgba(124,92,252,.55); }
.lp-pv-card.done { opacity: .55; }
.lp-pv-card.done .lp-pv-card-name { text-decoration: line-through; }
.lp-pv-card-name { font-size: 12px; font-weight: 600; line-height: 1.3; margin-bottom: 6px; }
.lp-pv-card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #a9a9bc; }
.lp-pv-tag { background: rgba(124,92,252,.18); border: 1px solid rgba(124,92,252,.3); color: #c4b5fd; padding: 1px 7px; border-radius: 999px; }
.lp-wait-form { display: flex; flex-direction: column; gap: 8px; }
.lp-wait-form input { padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: rgba(0,0,0,.25); color: #e8e8f0; font-size: 14px; font-family: inherit; outline: none; }
.lp-wait-form input:focus-visible { border-color: #7c5cfc; }
.lp-wait-err { font-size: 12px; color: #fca5a5; }
.lp-wait-ok { font-size: 13px; font-weight: 600; color: #86efac; text-align: center; padding: 10px 0; }
.lp-hero-auth { display: flex; justify-content: center; min-width: 0; }
.lp-hero-auth .auth-card { animation: none; width: 100%; max-width: 380px; }
.lp-section { max-width: 1100px; margin: 0 auto; padding: 56px 24px; }
.lp-h2 { font-size: 30px; font-weight: 800; text-align: center; margin: 0 0 8px; letter-spacing: -.02em; }
.lp-sub { text-align: center; color: #b8b8c8; margin: 0 0 36px; }
.lp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 36px; }
.lp-feature { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 24px; }
.lp-feature-icon { font-size: 28px; }
.lp-feature h3 { font-size: 17px; margin: 12px 0 6px; }
.lp-feature p { font-size: 14px; line-height: 1.55; color: #b8b8c8; margin: 0; }
.lp-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: start; }
.lp-plan { position: relative; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 28px 24px; }
.lp-plan-hi { border-color: rgba(124,92,252,.6); background: rgba(124,92,252,.08); box-shadow: 0 16px 48px rgba(124,92,252,.2); transform: scale(1.03); }
.lp-plan-tag { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #7c5cfc, #ec4899); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
.lp-plan-name { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #c4b5fd; }
.lp-plan-price { font-size: 36px; font-weight: 800; margin: 8px 0 2px; }
.lp-plan-price span { font-size: 14px; font-weight: 500; color: #a9a9bc; margin-left: 4px; }
.lp-plan-tagline { font-size: 13px; color: #b8b8c8; margin-bottom: 18px; }
.lp-plan-feats { list-style: none; padding: 0; margin: 0 0 22px; display: flex; flex-direction: column; gap: 9px; }
.lp-plan-feats li { font-size: 13px; color: #d8d8e4; }
.lp-plan-cta { width: 100%; }
.lp-cta-final { text-align: center; padding: 64px 24px; }
.lp-cta-final h2 { font-size: 28px; font-weight: 800; margin: 0 0 22px; }
.lp-footer { max-width: 1100px; margin: 0 auto; padding: 28px 24px 48px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.08); font-size: 13px; color: #a9a9bc; flex-wrap: wrap; gap: 12px; }
.lp-footer-links { display: flex; gap: 18px; }
.lp-footer-links a:hover { color: #e8e8f0; }
@media (max-width: 960px) {
  .lp-hero { grid-template-columns: 1fr; gap: 32px; }
  .lp-pv-board { grid-template-columns: repeat(2, 1fr); }
  .lp-hero-copy h1 { font-size: 32px; }
  .lp-hero-auth .auth-card { max-width: 420px; }
  .lp-grid, .lp-plans { grid-template-columns: 1fr; }
  .lp-plan-hi { transform: none; }
  .lp-nav-links a { display: none; }
}
@media (max-width: 480px) {
  .lp-nav, .lp-hero, .lp-section, .lp-footer { padding-left: 16px; padding-right: 16px; }
  .lp-hero-copy h1 { font-size: 27px; }
  .lp-h2 { font-size: 24px; }
}
`;

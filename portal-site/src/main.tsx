import React from 'react';
import ReactDOM from 'react-dom/client';
import { PublicPortal } from './PublicPortal';

// Rota: #/c/<slug>?t=<token>
function parseRoute(): { slug: string; token: string } | null {
  const h = window.location.hash || '';
  const m = h.match(/^#\/c\/([A-Za-z0-9_-]+)(?:\?t=([^&]+))?/);
  return m ? { slug: m[1], token: m[2] ? decodeURIComponent(m[2]) : '' } : null;
}

function Landing() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, background: '#f4f5f9', fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif', color: '#556', textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 40 }}>🌐</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1c24' }}>Portal do Cliente</div>
      <div style={{ fontSize: 14 }}>Abra pelo link que você recebeu do seu contato.</div>
    </div>
  );
}

const route = parseRoute();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {route ? <PublicPortal slug={route.slug} token={route.token} /> : <Landing />}
  </React.StrictMode>
);

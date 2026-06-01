import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { PublicPortal } from './components/PublicPortal';
import { initSentry } from './services/sentry';
import { installBrowserBridge } from './services/browserBridge';
import './styles/global.css';

// Compatibilidade web: instala window.walkersAPI no navegador ANTES de qualquer
// uso (no Electron isso é no-op, pois o preload já forneceu a ponte real).
installBrowserBridge();

// Monitoramento de erros (no-op sem VITE_SENTRY_DSN — ver SETUP-MONETIZACAO.md).
initSentry();

// Roteamento simples por hash: #/c/<slug> abre a página PÚBLICA do cliente
// (sem login, sem app). Qualquer outra URL carrega o app normal.
function getPortalRoute(): { slug: string; token: string } | null {
  const h = window.location.hash || '';
  const m = h.match(/^#\/c\/([A-Za-z0-9_-]+)(?:\?t=([^&]+))?/);
  return m ? { slug: m[1], token: m[2] ? decodeURIComponent(m[2]) : '' } : null;
}

const route = getPortalRoute();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {route ? <PublicPortal slug={route.slug} token={route.token} /> : <App />}
  </React.StrictMode>
);

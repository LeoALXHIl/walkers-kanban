// Sentry (renderer) — monitoramento de erros em produção.
//
// É INERTE sem `VITE_SENTRY_DSN`, então pode commitar sem configurar nada: em dev
// e enquanto a env não existir, initSentry() não faz nada. Pra ativar, crie um
// projeto em sentry.io, pegue o DSN e exporte VITE_SENTRY_DSN antes do build
// (ver SETUP-MONETIZACAO.md). Ao ativar, libere o domínio de ingest do Sentry no
// connect-src da CSP em index.html.
import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // no-op enquanto não configurado

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    // Performance tracing leve; ajuste conforme volume.
    tracesSampleRate: 0.1,
    // Privacidade: não enviar PII por padrão (LGPD).
    sendDefaultPii: false
  });
}

export { Sentry };

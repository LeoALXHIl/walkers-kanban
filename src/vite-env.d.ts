/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DSN do Sentry — se ausente, o monitoramento fica inerte. */
  readonly VITE_SENTRY_DSN?: string;
  /** Versão do app, injetada no release do Sentry. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

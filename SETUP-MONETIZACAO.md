# SETUP — Sprint 0 (passos que exigem suas contas)

Este guia cobre o que **eu não consigo fazer por você** porque depende de login/credencial sua. O código (testes, CI, Sentry, páginas legais) já está pronto no repositório. Faça estes passos na ordem.

---

## 1. Inicializar repositório Git + GitHub (destrava o CI)
A pasta ainda não é um repositório git. O CI (`.github/workflows/ci.yml`) só roda depois disto.

```bash
cd C:\Users\Leonardo\WalkersKanban
git init
git add .
git commit -m "chore: sprint 0 — CI, testes, Sentry, legal"
# crie um repo PRIVADO no GitHub e:
git remote add origin https://github.com/<voce>/walkers-kanban.git
git branch -M main
git push -u origin main
```
✅ Resultado: a aba **Actions** do GitHub mostra typecheck + testes + build rodando a cada push.

> Confira o `.gitignore` antes do primeiro commit — `node_modules`, `dist`, `release` e qualquer arquivo com segredo devem estar ignorados.

---

## 2. Sentry (monitoramento de erros) — DSN
O código já está integrado (`src/services/sentry.ts`) e **inerte** até você definir o DSN.

1. Crie conta em https://sentry.io → novo projeto **React**.
2. Copie o **DSN** (formato `https://xxxx@oXXX.ingest.sentry.io/XXX`).
3. No build de produção, defina a variável de ambiente:
   - PowerShell: `$env:VITE_SENTRY_DSN="https://...ingest.sentry.io/..."` antes de `npm run build`
   - ou crie um arquivo `.env.production` (NÃO commitar) com `VITE_SENTRY_DSN=...`
4. **CSP:** em `index.html`, adicione o host de ingest do Sentry ao `connect-src` da meta CSP (ex.: `https://*.ingest.sentry.io`), senão os eventos são bloqueados.
5. (Opcional, processo principal) Para capturar crashes do Electron: `npm i @sentry/electron` e descomente o bloco guardado no topo de `main.js`.

---

## 3. Google OAuth Verification (destrava o limite de 100 usuários)
Hoje o app está em **Testing** (máx. 100 e-mails). Para qualquer pessoa usar Calendar/Gmail:

1. https://console.cloud.google.com/apis/credentials/consent?project=walkerskambam
2. Preencha tudo: nome, logo, **link de Política de Privacidade** (publique o `legal/politica-de-privacidade.md` numa URL pública), domínios autorizados, e-mail de suporte.
3. Confirme os scopes sensíveis: `gmail.readonly`, `calendar.events`.
4. Clique **PUBLISH APP** → **Submeter para verificação**.
5. A revisão do Google leva ~2 a 6 semanas (pode pedir vídeo demonstrativo). **Faça isso primeiro**, pois roda em paralelo ao resto.

---

## 4. Domínio + DNS
1. Registre o domínio definitivo (ex.: `walkers.app`) — Registro.br, Namecheap ou Cloudflare Registrar.
2. Aponte o DNS para a Cloudflare (gratuito): nameservers + proxy ligado.
3. Subdomínios planejados:
   - `walkers.app` → site de vendas (Sprint 8)
   - `app.walkers.app` → app web (Sprint 1)
   - `portal.walkers.app` (ou domínio do cliente) → portal público
4. Adicione os domínios em **Firebase → Authentication → Settings → Authorized domains**.

---

## 5. Páginas legais — publicar
Os textos estão em `legal/`. Antes de publicar:
1. Substitua os placeholders: `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[email do DPO]`, `[DATA]`, `[CIDADE/UF]`.
2. **Peça revisão de um(a) advogado(a)** (responsabilidade, reembolso, foro).
3. Publique em URLs públicas (ex.: `walkers.app/termos`, `/privacidade`) — o Google exige a URL de privacidade na verificação OAuth.

---

## Comandos úteis (já configurados)
```bash
npm run test        # testes em watch
npm run test:run    # testes uma vez (usado no CI)
npm run typecheck   # tsc -b (checagem de tipos)
npm run dev         # app em desenvolvimento
npm run build       # build de produção
```

## Checklist Sprint 0
- [ ] git init + push (CI verde no GitHub Actions)
- [ ] Sentry DSN configurado + CSP liberada
- [ ] OAuth submetido para verificação
- [ ] Domínio + DNS + Authorized domains
- [ ] Placeholders legais preenchidos + revisão jurídica + páginas publicadas

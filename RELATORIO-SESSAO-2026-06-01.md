# Relatório da Sessão — Walkers Kanban

**Data:** 01/06/2026
**App:** Walkers Kanban v4.26.2 (`C:\Users\Leonardo\WalkersKanban`)
**Stack:** Electron + React 18 + TypeScript + Vite + Zustand + Firebase + MCP server

---

## 1. Diagnóstico completo do app

Varredura técnica nos 103 arquivos TS/React do projeto. App maduro: 17 views, 40+ componentes, 25+ services. Já possui workspaces multi-user, portal cliente white-label, AI Assistant (Claude API), Google Calendar/Gmail, webhooks, sprints/goals/roadmap e gamificação.

**Principal gap:** toda a camada comercial está faltando — sem billing, sem versão web, sem landing page, e OAuth Google em modo "Testing" (limite 100 usuários).

---

## 2. Plano de sprints (11 sprints, ~5 meses)

Roadmap de monetização com posicionamento de nicho: **"O kanban dos consultores de WhatsApp"** — freelancers e agências BR que implementam e gerenciam WhatsApp + e-commerce.

**Pricing definido:**

| Plano  | Preço          |
|--------|----------------|
| Free   | R$ 0           |
| Pro    | R$ 39/mês      |
| Team   | R$ 99/mês (3 users) |
| Agency | R$ 297/mês     |

**Projeção:** ~R$ 34k MRR em 12 meses (~R$ 400k ARR), margem > 85%.

---

## 3. Roadmap cadastrado no Walkers Kanban (via MCP)

11 cards na coluna "A Iniciar" (tags `roadmap` + `monetizacao`), cada um com objetivo, entregas e KPIs, vencimentos a cada 2 semanas (08/06 → 26/10):

| Sprint | Tema | Prioridade |
|--------|------|------------|
| 0  | Fundação (técnica + legal)          | Alta  |
| 1  | Web build + auth cross-device       | Alta  |
| 2  | Billing (Stripe + Pix)              | Alta  |
| 3  | Onboarding profissional + ativação  | Média |
| 4  | Portal Cliente premium              | Média |
| 5  | Mobile companion (PWA)              | Média |
| 6  | AI Assistant 2.0 + Automações       | Média |
| 7  | Integrações pagas (Team/Agency)     | Baixa |
| 8  | Site de vendas + SEO + Afiliados    | Baixa |
| 9  | Retenção + Expansão de receita      | Baixa |
| 10 | Launch público + ecossistema BR     | Baixa |

**Total:** 80+ subtarefas distribuídas nos 11 cards.

---

## 4. Sprint 0 implementada no código

### Arquivos criados

| Arquivo | O que faz |
|---------|-----------|
| `vitest.config.ts` | Configuração do Vitest |
| `src/vite-env.d.ts` | Tipos do Vite + env vars (`VITE_SENTRY_DSN`) |
| `src/services/sentry.ts` | Integração Sentry — inerte sem DSN |
| `src/services/__tests__/clients.test.ts` | 4 testes |
| `src/services/__tests__/streak.test.ts` | 6 testes |
| `src/services/__tests__/parser.test.ts` | 5 testes |
| `src/services/__tests__/markdown.test.ts` | 4 testes |
| `src/services/__tests__/storage.test.ts` | 5 testes |
| `.github/workflows/ci.yml` | CI: lint → typecheck → testes → build |
| `.github/PULL_REQUEST_TEMPLATE.md` | Template de PR |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Template de bug |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Template de feature |
| `legal/termos-de-uso.md` | Draft Termos de Uso (LGPD) |
| `legal/politica-de-privacidade.md` | Draft Política de Privacidade |
| `legal/lgpd-resumo.md` | Versão simplificada |
| `SETUP-MONETIZACAO.md` | Guia dos passos que exigem suas contas |

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/main.tsx` | `initSentry()` no boot |
| `main.js` | Sentry no processo principal (guarded) |
| `package.json` | +@sentry/react, +vitest; scripts `test`, `test:run`, `typecheck` |
| `src/services/parser.ts` | Correção de bug (abaixo) |

### Bug corrigido
`src/services/parser.ts` — voice-to-card/OCR não detectavam **"amanhã"** com acento (`\b` ASCII não casa com "ã"). Corrigido com lookahead Unicode `(?![\p{L}])`. "Depois de amanhã" agora retorna +2 dias. Travado com 2 testes.

### Verificado
- ✓ 24 testes passando (5 arquivos)
- ✓ TypeScript typecheck: exit 0
- ✓ Build de produção: exit 0 (430 módulos)

---

## 5. Sprint 0 no kanban
- Card movido para "Em Implementação"
- 4/7 subtarefas concluídas: ✅ Sentry · ✅ CI/CD · ✅ Templates · ✅ Vitest + testes
- ⏳ Pendentes (precisam das suas contas): OAuth Verification · Domínio+DNS · Legal publicado
- Comentário de status adicionado ao card

---

## 6. Pitch deck gerado

`WalkersKanban/walkers-pitch-deck.pptx` — 11 slides 16:9, paleta roxa da marca:

| # | Conteúdo |
|---|----------|
| 1  | Capa + tagline |
| 2  | Problema (4 dores) |
| 3  | Solução (6 capacidades) |
| 4  | Produto v4.26.2 (maturidade) |
| 5  | Diferencial (vs Trello/ClickUp/Notion) |
| 6  | Mercado (TAM/SAM/SOM) |
| 7  | Pricing (4 planos) |
| 8  | Roadmap (5 meses) |
| 9  | Projeção (gráfico MRR M1→M12) |
| 10 | Status/tração |
| 11 | The Ask + contato |

**QA:** conteúdo verificado nos 11 slides (sem tokens órfãos); abre como PDF válido de 11 páginas no LibreOffice. ⚠️ Sem QA pixel-a-pixel (máquina sem poppler/ImageMagick; Python é stub do Store) — recomendado abrir uma vez pro OK visual.

---

## 7. Pendente de você (ver `SETUP-MONETIZACAO.md`)
1. **git init + push** → ativa o CI
2. **Sentry DSN** → criar projeto em sentry.io + `VITE_SENTRY_DSN`
3. **Google OAuth Verification** → submeter (leva 2–6 semanas; protocole já)
4. **Domínio + DNS** → registrar e apontar pra Cloudflare
5. **Páginas legais** → preencher CNPJ/razão social/DPO + revisão jurídica + publicar

---

## Próximos passos recomendados
1. Abrir o deck e validar visualmente
2. git init + push (custo zero, ativa CI)
3. Submeter OAuth hoje (aprovação vem em semanas)
4. 5 entrevistas de 20min com freelancers antes de codar billing (Sprint 2)

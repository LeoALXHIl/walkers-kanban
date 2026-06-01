# Walkers Kanban v4.2 — Vite + React + TS + Zustand + electron-builder

Kanban moderno com **Firebase Auth + Firestore por usuário**, **MCP que escreve direto no Firestore** (Claude muda → app atualiza real-time, mesmo fechado), tray icon + auto-launch + auto-update, **Cmd+K command palette**, **streak diário** com heatmap, e **Weekly Wrap** automático.

---

## ✨ Novidades v4.14 — Cliente 360° 📊

Transformei o ClientDetailModal num **CRM completo** pra você ver tudo de um cliente num lugar só.

### 6 KPIs visuais no topo

- 📋 **Total cards** (ativos vs concluídos)
- 📈 **Taxa de conclusão** (% concluídos / total)
- 💰 **Total faturado** (R$) + ticket médio
- ⏱️ **Valor/hora** cadastrado
- 📅 **Próxima reunião** com data + hora
- 📊 **Crescimento 30d** (cards últimos 30d vs 30d anteriores, com %)

### 4 ações rápidas no header

- ✨ **Card** — cria novo card pré-preenchido com nome do cliente
- 📅 **Reunião** — abre o agendador com email do cliente já adicionado como convidado
- ✉️ **Email** — abre o cliente padrão de email (mailto:)
- 💬 **WhatsApp** — abre o wa.me com o número do cliente

### Nova aba "📅 Reuniões"

Lista **todas as reuniões do Google Calendar** com esse cliente (filtrando por email do cliente nos attendees ou nome no título):
- Próximas (com botão "Entrar" pro Meet)
- Passadas (histórico até 90 dias)
- Botão pra agendar nova reunião direto

### Atividade unificada

A timeline agora mistura cards criados, comentários, reuniões agendadas e realizadas — tudo em ordem cronológica.

---

## ✨ v4.13 — Agendar reuniões 📅

Agora dá pra **criar reuniões direto no Google Calendar** sem sair do Walkers, com link do Google Meet automático.

### 3 lugares pra agendar

1. **Topbar → 📅 Reunião** — botão sempre disponível
2. **Calendar view → 📅 Nova reunião** ou click direto num dia do grid
3. **Card → 📅 Agendar reunião** (no rodapé do CardDetail)
   - Pré-preenche título com o nome do card
   - Cola a descrição do card no evento
   - Se o cliente tem email cadastrado em ClientProfiles, já adiciona como convidado
   - Linka o card no corpo do evento

### Opções

- **🎥 Criar link do Google Meet** automático (copia pro clipboard depois)
- **✉️ Notificar convidados** por email (manda invite oficial do Google)
- Convidados como chips removíveis
- Durações pré-definidas: 15/30/45/60/90/120 min

### Importante: re-autorização Google

A v4.13 usa um scope novo (`calendar.events` em vez de só `.readonly`). Da primeira vez que você abrir o app, ele vai pedir pra reconectar com Google e aceitar a nova permissão de "Criar e modificar eventos do Calendar". Aprova uma vez e tá feito.

### Melhorias no Calendar view

- Eventos mais visíveis (texto maior, mais altura nos dias)
- Click em qualquer dia abre o modal de reunião pré-preenchido com aquela data
- Auto-refresh quando você cria uma reunião nova

---

## ✨ v4.12 — Múltiplos Boards 🏢 + Custom Fields 🏷️

Agora dá pra separar **contextos completamente diferentes** em boards isolados (Implementações, Pessoal, Estudos, Cliente X…) — cada um com suas próprias colunas, cards, e campos personalizados.

### 🏢 Múltiplos Boards

- **Switcher no topo da sidebar**: clica no nome do board atual, abre dropdown com todos os boards
- **Cada board é isolado**: cards, colunas e custom fields são por-board
- **Filtros automáticos**: Kanban, Lista, Dashboard, Analytics, Calendar, Archive, MyTasks — todos filtram pelo board ativo
- **Migração transparente**: tudo que você tem hoje vira o board "🚀 Implementações" automaticamente
- **Cmd+K**: comandos pra trocar de board, criar novo, editar atual
- **Templates são globais**: o mesmo template funciona em qualquer board

### Como criar um board

1. Click no nome do board atual (topo da sidebar) → `+ Novo Board`
2. Escolhe nome, emoji e cor
3. O novo board já vem com as 4 colunas padrão (A Iniciar / Em Implementação / Aguardando Cliente / Concluído) — você customiza depois
4. Cards criados nesse board ficam só nesse board

### 🏷️ Custom Fields (campos personalizados)

Cards no Walkers tinham só os campos fixos (nome, cliente, prio, plataforma…). Agora você pode adicionar **qualquer campo personalizado por board**:

- 📝 **Texto** — observações livres, IDs externos
- #️⃣ **Número** — métricas, contagens
- 🔗 **URL** — webhook, link de pedido, endpoint da API (com botão "Copiar" e "Abrir no navegador")
- 💰 **Valor R$** — formatado automaticamente como moeda brasileira
- 📅 **Data** — para datas específicas além do `due`
- 🎯 **Seleção** — lista de opções (ex: status, categoria)

### Como configurar

1. Switcher da sidebar → `🏷️ Custom Fields`
2. `➕ Adicionar campo` → nome + tipo
3. Marca "Mostrar valor no preview do card" pra ver o chip direto no kanban
4. Volta no card: a seção "🏷️ Custom Fields" aparece entre Descrição e Subtarefas

### Casos de uso reais

```
Board "Implementações" custom fields:
  - 🔗 URL do Webhook  (showOnCard: ✓)
  - 🔗 Painel admin
  - 💰 Valor cobrado    (showOnCard: ✓)
  - 🎯 Status do contrato: [Em análise, Aprovado, Recusado]

Board "Pessoal":
  - 📅 Próxima revisão
  - 🎯 Energia: [Alta, Média, Baixa]
```

---

## ✨ v4.11 — Templates 📋

Implementação WhatsApp+Magazord = 8 subtarefas iguais. Em vez de criar do zero toda vez, agora vira **1 clique**.

### Como funciona
- Nova view **Templates** na sidebar
- Cria template manualmente OU **a partir de um card existente** (botão "💾 Salvar como template" no rodapé do CardDetail)
- Template guarda: nome, emoji, descrição, coluna padrão, prioridade, plataformas, cor, nota, descrição, tags, subtarefas
- **Use `{{cliente}}` no nome/nota/desc** — substituído pelo nome do cliente ao usar

### Onde usar
- **Templates view**: lista todos, click "✨ Usar template" → pergunta cliente → card criado
- **Novo card modal**: dropdown "Usar template (opcional)" no topo
- **Cmd+K**: cada template aparece como comando "Criar card de template: X"

### Exemplos práticos
```
📋 "Implementação WhatsApp"
  - Nome do card: {{cliente}} - Integração WhatsApp
  - Subtarefas:
    1. Mapear campos do funil
    2. Criar gatilhos no Zoopi
    3. Configurar imagens
    4. Testar fluxo
    5. Validar com cliente
    6. Deploy
  - Tags: whatsapp, magazord
  - Plataforma: WhatsApp

📋 "Check-in mensal"
  - Nome: Check-in mensal - {{cliente}}
  - Coluna: Aguardando Cliente
  - Subtarefas: "Mandar relatório", "Pedir feedback"
```

## 📦 PRA DISTRIBUIR (você, dono do app)

Antes de empacotar o instalador pros seus clientes, configure uma vez:

### 1. Crie um Desktop OAuth Client (uma vez)

1. Abra https://console.cloud.google.com/apis/credentials?project=walkerskambam
2. **+ CRIAR CREDENCIAIS → ID do cliente OAuth**
3. Tipo de aplicativo: **Aplicativo para computador** (Desktop app) ⚠️ NÃO Web!
4. Nome: `Walkers Kanban`
5. **Criar** → copia o Client ID

### 2. Configure o OAuth Consent Screen

1. https://console.cloud.google.com/apis/credentials/consent?project=walkerskambam
2. Tipo: **External**
3. Preencha: nome do app, logo, support email, link de privacy policy
4. **Adicione os scopes**: `gmail.readonly` e `calendar.events.readonly`
5. Status atual: **"Testing"** — até 100 usuários (adicione cada email manualmente como Test User)
6. Pra ir além de 100: clica **PUBLISH APP** e submete pra **OAuth verification** (processo do Google, ~2-6 semanas)

### 3. Embed o Client ID no app

Edita [`src/services/firebase.ts`](src/services/firebase.ts) linha do `EMBEDDED_GOOGLE_CLIENT_ID`:

```ts
export const EMBEDDED_GOOGLE_CLIENT_ID = '192188793356-xxxxxxxx.apps.googleusercontent.com';
```

### 4. Rebuilda e distribui

```bash
npm run dist
```

Pega o `release/Walkers-Setup-X.Y.Z.exe` e manda pros clientes.

**Pro cliente:** ele instala, clica **"Conectar Google (Persistente)"** uma vez, aceita as permissões → funciona pra sempre, sem nenhum setup do lado dele.

### ⚠️ Limite de 100 test users

Até passar pela verificação do Google, **só 100 emails** podem usar Calendar/Gmail. Pra ir além:

- Pra cada novo cliente, adiciona o email dele em "Test Users" no OAuth Consent Screen
- OU submete pra OAuth Verification (Google revisa em 2-6 semanas, daí qualquer um usa)
- OU use scopes não-sensitive (mas Gmail e Calendar **são** sensitive)

---

## ✨ Novidades v4.10 — ♾️ Modo Persistente Google (token vitalício)

Você cria UMA vez um Desktop OAuth Client e o app passa a renovar tokens **automaticamente por ~6 meses** sem nenhum popup. Funciona pra Calendar + Gmail simultaneamente.

### Como funciona
- Refresh_token Google é **armazenado criptografado** em disco (Electron `safeStorage`)
- Token renova **silencioso via main process** (HTTP direto pra `oauth2.googleapis.com`)
- Renderer pede access_token via IPC, recebe sempre válido
- Dura até você revogar o app em https://myaccount.google.com/permissions

### Setup (1 minuto, 1 vez só)

1. Abre [Google Cloud Console → Credenciais](https://console.cloud.google.com/apis/credentials?project=walkerskambam)
2. **+ CRIAR CREDENCIAIS** → **ID do cliente OAuth**
3. Tipo: **Aplicativo para computador (Desktop app)**
4. Nome: `Walkers Kanban Desktop`
5. **Criar** → copia o Client ID (formato: `123-xxx.apps.googleusercontent.com`)
6. No app, **Integrações** (tecla 8) → seção **♾️ Modo Persistente**
7. Cola o Client ID → **Conectar Persistente**
8. Abre o navegador, autoriza → fecha aba → ✅ feito pra sempre

### Vantagens vs modo padrão
| | Modo padrão (Firebase popup) | Modo Persistente |
|---|---|---|
| Duração | ~1h | ~6 meses |
| Renovação | Popup do Google | Silenciosa, via IPC |
| Interação | Sim, a cada hora | Zero |
| Funciona offline | Não | Não (precisa internet pra renovar) |

## ✨ Novidades v4.9 — Quick Wins

### 📦 Sistema de Arquivo (não-destrutivo)
- Apagar card agora oferece **2 opções**: 📦 Arquivar (default) OU 🗑️ Apagar permanente
- Nova view **Arquivo** (sidebar) — lista todos os cards arquivados, busca, restaurar, apagar permanente
- Cards arquivados ficam invisíveis nas outras views mas dados preservados

### ⭐ Pin/Star + Sort manual
- Botão ⭐/☆ em cada card pra fixar no topo da coluna
- Cards fixados ganham **borda dourada** sutil
- Pinned sempre primeiro, depois ordem manual, depois por data

### ✏️ Inline edit
- **Double-click no nome do card** → vira input → Enter salva, Esc cancela
- Sem precisar abrir modal pra renomear

### 📋 Duplicar card
- Botão 📋 no card → cria cópia com "(cópia)" no nome
- Subtarefas copiadas mas resetadas, comentários NÃO copiados

### 🔍 Click-to-filter
- Click em qualquer **tag** → filtra por aquela tag
- Click em **plataforma** (WhatsApp/Insta/Msg) → filtra
- Click em **responsável** → filtra por nome
- Toast confirma: "Filtrando por X"

### 🏷️ Filter Chips
- Faixa abaixo do topbar mostra **filtros ativos** com [×]
- Aparece só no Kanban/Lista
- Botão "Limpar tudo" pra resetar

### ⌨️ Cheatsheet (`?`)
- Aperta **`?`** de qualquer lugar → modal com TODOS os atalhos
- Categorias: Views, Ações, Card, Palette, Voice+OCR

## ✨ Novidades v4.8 — Visualização Premium

### 📧 Emails (tecla 0) — tela dedicada
- Layout 2-painéis: lista de emails à esquerda, conteúdo completo à direita
- **6 filtros rápidos**: Inbox, Não lidos, Estrelados, Últimos 7d, Com anexo, Importantes
- Search local nos emails carregados
- Avatares coloridos com hash do remetente
- **Não lidos** ficam com fonte bold + destaque
- Botões: **+ Criar card** e **Abrir no Gmail**
- Auto-detecta erros: API não habilitada / sem permissão / token expirado

### 📅 Calendar redesenhado
- **Eventos com reunião** agora têm:
  - 🎥 ícone destacado
  - Fundo verde com gradient
  - Borda esquerda verde sólida (3px)
  - Horário em fonte mono bold
- **Eventos sem reunião** azuis (📅 ícone)
- **Click no evento** → abre **EventDetailModal** com:
  - Título grande + horário em destaque
  - Provider detectado (Meet/Zoom/Teams/Whereby)
  - **Botão grande "🎥 Entrar na reunião"** + copiar link
  - Localização
  - Descrição completa (HTML stripped)
  - Lista de participantes com avatares + status (✓ Aceito / ✗ Recusou / ? Talvez / ⏳ Sem resposta)
  - Botão "Abrir no Google Calendar"

## ✨ Novidades v4.7 — Integração Google REAL

### 📅 Google Calendar
- Login com Google agora pede scopes `calendar.events.readonly` e `gmail.readonly`
- Nova tela **Calendar** (tecla `9`) com grid mensal mostrando:
  - **Cards do Walkers** posicionados nas datas de vencimento
  - **Eventos do Google Calendar** sobrepostos (mesmos dias)
  - **📞 = evento com link de reunião** (Meet/Zoom/etc) — click pra abrir direto
  - **📅 = evento sem reunião** — click abre no Calendar Web
- **Drag-and-drop**: arraste um card entre dias pra remarcar a due date
- Click em dia vazio → cria card naquele dia

### 📥 Gmail → Card
- Nova seção **Gmail** em Integrações
- Query Gmail nativa: `is:unread label:walkers from:cliente@x.com newer_than:7d`
- Lista emails matching com remetente / assunto / snippet
- Click **+ Card** em qualquer email → carrega corpo + parsing automático (tags, prioridade, data) → abre NewCardModal pré-preenchido

### 📤 Export iCal (.ics)
- Botão em Integrações **⬇ Baixar .ics**
- Gera arquivo com todos os cards que têm vencimento
- Importe no Google Calendar / Apple Calendar / Outlook
- Cards concluídos vêm com prefixo `[CONCLUÍDO]`

### 🔐 Conexão Google
- Token Google fica visível no topo de Integrações com status (🟢/🟡/🔴) e horário de expiração
- Botão **Reconectar** quando expira (token Google dura ~1h)
- Walkers nunca envia nada por você — só lê

## ✨ Novidades v4.6 — 3 telas novas

### 👥 Clientes (CRM)
- Tela dedicada listando **TODOS os clientes únicos** (extraídos dos cards automaticamente)
- Cards visuais com avatar + nome + métricas (total cards, ativos, atrasados, plataformas)
- Sort: mais recente / mais cards / mais atrasos / alfabético
- Search por nome, tag, telefone, email
- **ClientDetailModal** com 3 tabs:
  - **Cards** — todos os cards desse cliente, click pra abrir
  - **Perfil** — telefone, email, social, valor/hora, total faturado, notas, tags, arquivar
  - **Atividade** — timeline cronológica (criados, comentários)
- Atalho: tecla **6** ou Ctrl+K → "clientes"

### 📊 Analytics
- **Trends week-over-week** (4 KPIs com delta ↑↓ vs semana anterior)
- **Funil de cards por etapa** + **tempo médio em cada coluna** com detecção automática de **gargalos**
- **Heatmap 7×24** mostrando quando você cria cards
- **Top 5 clientes** por volume + % conclusão
- **Por plataforma** (WhatsApp / Instagram / Messenger)
- Atalho: tecla **7** ou Ctrl+K → "analytics"

### 🔗 Integrações
- **Webhooks** funcionando (POST HTTP em eventos `card.created` / `moved` / `completed` / `deleted`) — use pra Zapier, Make, n8n, Discord, Slack
- Configure URL, escolha eventos, pause/ative individualmente
- **Placeholders** pra Google Calendar, Slack/Discord direto, Email-to-card, WhatsApp Business API, Notion (em breve)
- Atalho: tecla **8** ou Ctrl+K → "integrações"

### 🧰 Backend
- Novos tipos: `ClientProfile`, `ClientProfileMap`, `WebhookConfig`, `IntegrationsConfig`
- Migração automática inicializa `clientProfiles: {}` e `integrations: { webhooks: [] }`
- Webhooks disparam automaticamente em `addCard`, `deleteCard`, `moveCard` (fire-and-forget)
- Storage de profile e webhooks via `updateClientProfile`, `addWebhook`, `updateWebhook`, `deleteWebhook`

## ✨ Novidades v4.5
- **Compact mode no MCP** — `list_cards` agora retorna formato compacto por padrão (~70% menos tokens Anthropic). Use `detailed: true` quando precisar dos campos completos. Default `limit: 50`. **Versão MCP: 3.3.0**.
- **Toast system** — notificações flutuantes transientes (criar card, mover, deletar) com 4 variantes (success/error/warn/info). Diferente das notifications persistentes da Inbox.
- **Empty state** no Kanban — quando board tá sem cards, CTA bonita pra criar o primeiro
- **Toast no drop** — cada movimentação dispara feedback visual, com mensagem especial pra quando atinge a última coluna

## ✨ Novidades v4.4
- **Snapshot compartilhável** (1080×1080 PNG via Canvas API, sem deps) — 3 tipos:
  - **Streak** (🔥 + número + heatmap mini)
  - **Weekly Wrap** (4 stat tiles em grid)
  - **Achievement** (emoji gigante + nome + descrição)
- Botões **📤 Compartilhar** no StreakModal, WeeklyWrapModal e AchievementToast
- 2 ações no clipboard: **Copiar imagem** (cola direto em qualquer lugar) e **Salvar PNG** (Downloads)
- Comandos no palette: "Compartilhar streak (PNG)" e "Compartilhar semana (PNG)"

## ✨ Novidades v4.3
- **Voice-to-card** (botão 🎤 no topbar ou Ctrl+K → "voz") — fala em pt-BR e o card é criado pré-preenchido (nome, plataforma, prioridade, data extraídos por heurística)
- **OCR de print** (Ctrl+V em qualquer lugar do app, ou botão 📷 no topbar) — Tesseract.js v5 com modelo `por`, lazy-loaded da CDN (~5MB no primeiro uso)
- **NewCardModal pré-preenchido** — voz/OCR alimentam name/note/plat/prio/due antes de você confirmar
- **Achievements / Badges** (26 conquistas) com toast popup + confetti ao desbloquear, grid no StreakModal
- **`refresh_data` tool no MCP** + cache 24h pra economizar Firestore reads

## ✨ Novidades v4.2
- **MCP server escreve direto no Firestore** — Claude muda algo via MCP e o desktop app vê via `onSnapshot` real-time, mesmo se ele tava fechado quando a edição aconteceu
- **Token bridge**: o app escreve `~/.walkers-kanban/auth.json` (idToken + refreshToken) toda vez que loga ou refresca; o MCP lê esse arquivo, refresca token quando expira, e usa Firestore REST API com o `idToken` do user — mantém security rules
- **Multi-device de verdade**: edita no Claude do trabalho → vê no PC de casa instantaneamente
- **Fallback local automático** — se sem internet ou sem login, MCP cai pro `data.json` local e segue funcionando read-only

## ✨ Novidades v4.1
- **electron-builder** (substitui electron-packager) — gera instalador `.exe Setup`
- **Tray icon** — fechar a janela mantém o app na bandeja; clique pra reabrir
- **Auto-launch** opcional — abre com o Windows, inicia minimizado
- **Auto-update** (electron-updater) — verificação automática + manual em Configurações
- **Notificações OS** — atualização baixada / streak em risco
- **SettingsModal** completo (ícone ⚙️ no chip de usuário)
- **Cmd+K Command Palette** — fuzzy search em ações, views, filtros, cards
- **Streak** com heatmap GitHub-style + **Weekly Wrap** automático

## ✨ v4.0 (base)
- Refatorado de monolito pra projeto modular (Vite + React + TS + Zustand)
- Firebase Auth completo (email/senha + Google) + per-user Firestore
- CSP estrita, XSS mitigado, sandbox: true
- Servidor HTTP local em prod (resolve Google sign-in no Electron)
- Atalhos: `N` `/` `1-5` `Esc` `Ctrl+K`
- Confetti, avatares com hash, filtros persistentes

---

## 🚀 Setup

### Pré-requisito
Node.js LTS — https://nodejs.org/

### 1. Instalar dependências (primeira vez ou após mudanças no package.json)
```bash
npm install
```

### 2. Configurar Firebase (uma vez)

No Firebase Console (https://console.firebase.google.com/project/walkerskambam):

#### a) Authentication → Sign-in method
- **Email/Password** → Enable
- **Google** → Enable (preencha "Support email")

#### b) Firestore Database → Rules — cole estas regras:
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /kanban/{doc} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

### 3. Rodar em modo dev (com hot reload)
```bash
npm run dev
```
Roda Vite (porta 5173) + Electron apontando pro dev server. HMR funciona.

### 4. Build de produção
```bash
npm run build
```
Gera `dist/` com bundle otimizado.

### 5. Gerar instalador Windows (`.exe Setup`)
```bash
npm install      # se ainda não rodou após v4.1 — pega electron-builder + electron-updater
npm run dist
```
- Gera `release/Walkers-Setup-X.Y.Z.exe` — instalador NSIS completo
- Atalho na área de trabalho + menu Iniciar + entrada em Adicionar/Remover programas
- Roda em background (tray) e atualiza sozinho quando publish estiver configurado

Pra gerar apenas a pasta unpacked (mais rápido, sem instalador):
```bash
npm run dist:dir
```

### 6. Rodar localmente (sem instalador)
```bash
npm start
```
Carrega `dist/` num servidor HTTP local — Google sign-in funciona.

---

## 🤖 Conectar Claude Desktop (MCP)

### Pré-requisito
**Abra o app Walkers Kanban e faça login pelo menos uma vez** — ele grava `~/.walkers-kanban/auth.json` com os tokens que o MCP usa pra falar com o Firestore como você.

### Setup

1. Abra o **Claude Desktop**
2. **Settings → Developer → Edit Config**
3. Adicione no JSON (ajustando o caminho):
```json
{
  "mcpServers": {
    "walkers-kanban": {
      "command": "node",
      "args": ["C:\\Users\\Leonardo\\Downloads\\walkers-kanban-v4\\walkers-kanban-v3\\mcp-server.js"]
    }
  }
}
```
4. Salve e reinicie o Claude Desktop.
5. Settings → Developer → deve aparecer **walkers-kanban** com **15 ferramentas**.

### Como funciona

```
[App desktop login]
       ↓ grava token + refreshToken
~/.walkers-kanban/auth.json
       ↑ lê + refresca
[MCP server (Claude Desktop)]
       ↓ Firestore REST API com Bearer idToken
[Firestore: users/{uid}/kanban/main]
       ↓ onSnapshot
[App desktop] — atualiza UI em real-time
```

- Token expira a cada 1h, o MCP refresca automaticamente via `securetoken.googleapis.com` (refresh é grátis)
- Security rules continuam ativas: Claude só consegue acessar o doc do seu user
- Logout no app apaga o `auth.json` → MCP perde acesso até você logar de novo

### Cache de 24h (economia de Firestore reads)

Pra não estourar quota Firestore gratuita, o MCP **cacheia o board por 24h**:
- **Writes** (criar/mover/comentar via Claude) → sempre real-time, atualizam o cache automaticamente
- **Reads** (listar, get_card, get_stats) → usam cache, só re-buscam do Firestore 1x por dia
- **Mudou no app desktop e quer ver no Claude AGORA**? Diga: *"Claude, atualiza o kanban"* — ele chama a tool **`refresh_data`** que força um read fresco do Firestore

Total: **16 ferramentas** (15 antigas + `refresh_data`).

---

## 📁 Estrutura

```
walkers-kanban-v3/
├── main.js              ← Electron main (dev → :5173, prod → dist/index.html)
├── preload.js           ← IPC bridge
├── mcp-server.js        ← MCP server (15 ferramentas)
├── index.html           ← Vite entry → src/main.tsx
├── index.legacy.html    ← Backup do monolito anterior
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── global.d.ts
│   ├── store/           ← Zustand stores
│   │   ├── auth.ts
│   │   ├── data.ts      ← cards, columns, Firestore sync, mutations
│   │   ├── ui.ts        ← view, filters, modals, persistence
│   │   └── notifications.ts
│   ├── services/
│   │   ├── firebase.ts  ← init app, auth, db, friendlyAuthError
│   │   ├── colors.ts    ← pickHashColor, safeUrl
│   │   ├── markdown.ts  ← mdToHtml seguro
│   │   ├── storage.ts   ← DEFAULT_DATA, migrateData, dueInfo, fmt
│   │   ├── confetti.ts
│   │   └── icons.tsx    ← SVGs + PLAT/PRIO constants
│   ├── hooks/
│   │   └── useFilteredCards.ts
│   ├── views/
│   │   ├── Login.tsx
│   │   ├── Kanban.tsx
│   │   ├── List.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Inbox.tsx
│   │   └── MyTasks.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── UserChip.tsx
│   │   ├── Card.tsx
│   │   ├── Column.tsx
│   │   ├── CardDetail.tsx
│   │   ├── NewCardModal.tsx
│   │   ├── ColumnModal.tsx
│   │   ├── ConfirmModals.tsx
│   │   └── McpInfoModal.tsx
│   └── styles/
│       └── global.css
└── README.md
```

---

## 💾 Dados

- **Local**: `~/.walkers-kanban/data.json` (cache + offline + MCP source)
- **Cloud**: Firestore em `users/{uid}/kanban/main`

Backup: copie o doc do Firestore Console, OU o data.json local.

---

## ⌨️ Atalhos

| Tecla | Ação |
|---|---|
| `Ctrl+K` | **Command Palette** (busca tudo) |
| `N` | Novo card |
| `/` | Focar busca |
| `Ctrl+V` (imagem) | Abre OCR direto com a imagem |
| `1` | Kanban |
| `2` | Lista |
| `3` | Dashboard |
| `4` | Caixa de Entrada |
| `5` | Minhas Tarefas |
| `6` | Clientes (CRM) |
| `7` | Analytics |
| `8` | Integrações |
| `9` | Calendar |
| `0` | Emails (Gmail) |
| `?` | Cheatsheet (todos os atalhos) |
| `Esc` | Fechar modal |

## ⚙️ Configurações (ícone ⚙️ no chip de usuário, ou Ctrl+K → "Configurações")

- **Minimizar para a bandeja ao fechar** — app continua rodando, tray icon visível
- **Iniciar com o Windows** — auto-launch minimizado na bandeja
- **Notificações do sistema** — toasts de atualização + streak em risco
- **Verificar atualizações** — manual; auto-check 5s após boot

## 🔥 Streak & Weekly Wrap

- Toda mutação (criar/mover/completar card, comentar, etc.) **conta como atividade do dia**
- Sidebar mostra **🔥 N dias** com cor: verde (ok), pulsando vermelho (em risco), cinza (cold)
- Clique no pill → modal com heatmap 12 semanas + stats 7d/30d
- **Weekly Wrap** abre automaticamente na primeira vez que você abre o app numa nova semana ISO
- Comando palette: "Ver streak e atividade" / "Weekly Wrap"

## 📦 Auto-update (configuração opcional)

O app já está pronto pra auto-update via `electron-updater`. Pra ativar:

1. Edite [`electron-builder.yml`](electron-builder.yml) descomentando a seção `publish:`
2. Escolha um provider:
   - **GitHub Releases** (mais fácil) — `provider: github` + nome do repo
   - **Servidor estático** — `provider: generic` + URL do servidor
3. Configure secrets de publish (ex: `GH_TOKEN`) e rode `npm run publish` pra publicar

Sem configurar, o app simplesmente não tenta verificar atualizações (sem erro).

---

## ❓ Problemas comuns

**"O Claude não vê o walkers-kanban"** → Confirme o caminho do `mcp-server.js` e use barras duplas `\\`.

**"Server disconnected" no Claude** → Rode `node "caminho\mcp-server.js"` no CMD pra testar.

**"Vite não inicia"** → Rode `npm install` primeiro. Confirme Node.js 18+ via `node --version`.

**Google sign-in falha com "auth/unauthorized-domain"** → Adicione o domínio em Firebase Console → Authentication → Settings → Authorized domains.

**Popup do Google bloqueado** → No modo dev, garante que está rodando via `npm run dev` (não direto pelo arquivo). Em produção, o `main.js` já libera popups dos domínios de auth.

---

🎉 v4.0 = arquitetura pronta pra escalar. Próximos lotes: monetização (Stripe + Pix), Cmd+K palette, gamificação, mobile companion.

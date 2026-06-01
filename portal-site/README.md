# Walkers — Portal do Cliente (site standalone)

Site estático (Vite + React) que mostra o portal público do cliente.
Lê os dados do mesmo Firebase do app Walkers Kanban (coleção `publicShares`).
Publique no Vercel (ou Netlify, ou qualquer host estático).

## Publicar no Vercel

### Opção A — Arrastar a pasta `dist` (sem terminal, mais fácil)
1. Aqui na pasta `portal-site`, gere o build (uma vez):
   ```
   npm install
   npm run build
   ```
   Isso cria a pasta `dist`.
2. Entre em https://vercel.com (crie conta grátis)
3. **Add New → Project → Deploy** e arraste a pasta **`dist`**
   (ou use "Deploy a static folder")
4. Vercel te dá uma URL, ex: `https://walkers-portal.vercel.app`

### Opção B — Conectar via Git (atualiza sozinho)
1. Suba a pasta `portal-site` num repositório (GitHub/GitLab)
2. No Vercel: **Add New → Project → Import** o repositório
3. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Deploy. A cada push, atualiza automaticamente.

## ⚠️ Depois de publicar — me passe a URL
Quando você tiver a URL do Vercel (ex: `https://walkers-portal.vercel.app`),
me avise pra eu trocar o `PORTAL_BASE` no app principal
(`src/services/publicShares.ts`). Aí os links gerados no app já saem
apontando pro seu Vercel:
```
https://walkers-portal.vercel.app/#/c/<slug>?t=<token>
```

## Domínio próprio (opcional)
No Vercel: **Project → Settings → Domains → Add** seu domínio
(ex: `portal.seudominio.com`) e siga os registros DNS. Depois é só
atualizar o `PORTAL_BASE` pra esse domínio.

## Como funciona
- Rota por hash: `#/c/<slug>?t=<token>`
- Lê `publicShares/{slug}` (leitura pública nas regras do Firestore)
- Valida o `token` (porta extra) e o `PIN` (se houver) no cliente
- Cliente pode comentar e aprovar etapas (gravam em `publicShares/{slug}`)
- **Nunca** acessa dados privados do kanban — só o snapshot liberado

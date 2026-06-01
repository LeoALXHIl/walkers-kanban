# SETUP — Conexão Google Persistente (proxy total)

O backend já está no código (Functions + rules + rewrite). Para **ativar**, faça estes passos — eles dependem das suas contas. Depois disso, eu ligo o frontend (Fase 2) e testamos.

## Como funciona (resumo)
O navegador nunca vê tokens do Google. Você autoriza uma vez → uma Cloud Function guarda o `refresh_token` num cofre no Firestore (`googleAuth/{uid}`, bloqueado pro cliente). As leituras de Calendar passam pela callable `googleCalendar`, que renova o token sozinha. **Zero reconexão.**

---

## 1. Criar um OAuth client tipo **Web** (não Desktop)
1. https://console.cloud.google.com/apis/credentials?project=walkerskambam
2. **+ CRIAR CREDENCIAIS → ID do cliente OAuth**
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: `Walkers Kanban Web`
5. **URIs de redirecionamento autorizados** → adicione **exatamente**:
   ```
   https://walkerskambam.web.app/api/google/callback
   ```
6. (Opcional) **Origens JavaScript autorizadas:** `https://walkerskambam.web.app`
7. **Criar** → copie o **Client ID** e o **Client Secret**.

## 2. Configurar as credenciais nas Functions
No terminal, dentro da pasta do projeto:

```bash
# Client ID (não é segredo) — vai num .env das functions
echo GOOGLE_CLIENT_ID=SEU_CLIENT_ID_WEB.apps.googleusercontent.com > functions/.env

# Client Secret (segredo) — guardado no Secret Manager
npx firebase functions:secrets:set GOOGLE_CLIENT_SECRET
# (cole o Client Secret quando pedir)
```

## 3. Configurar o frontend
No `.env.production` (na raiz), adicione a linha:
```
VITE_GOOGLE_OAUTH_CLIENT_ID=SEU_CLIENT_ID_WEB.apps.googleusercontent.com
```
(o mesmo Client ID do passo 1 — é público, o frontend usa pra montar a tela de consentimento)

## 4. Garantir a Calendar API ativada
https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=walkerskambam → **Ativar** (se já não estiver).

## 5. Deploy
```bash
npm run build
npx firebase deploy --only functions,firestore:rules,hosting
```
> O primeiro deploy de Functions novas pode levar 1–3 min. Precisa do plano **Blaze** (já ativo — você já tem `notifyAssignment`/`powerbi`).

---

## Depois disso (Fase 2 — eu faço)
- Ligo o botão **"Conectar Google (não expira)"** na aba Integrações usando o fluxo persistente.
- Troco o Calendar do app pra ler via proxy (`listCalendarEventsProxy`) em vez do token do cliente.
- Trato o retorno `?google=connected` com um toast de sucesso.
- Testamos: conectar → ver eventos → fechar e reabrir (sem reconectar).

## Checklist
- [ ] OAuth client **Web** criado + redirect URI registrado
- [ ] `functions/.env` com `GOOGLE_CLIENT_ID`
- [ ] secret `GOOGLE_CLIENT_SECRET` setado
- [ ] `VITE_GOOGLE_OAUTH_CLIENT_ID` no `.env.production`
- [ ] Calendar API ativada
- [ ] `firebase deploy --only functions,firestore:rules,hosting`

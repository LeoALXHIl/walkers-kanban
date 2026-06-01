# 📧 Notificação de atribuição por email (Cloud Function)

Quando alguém é atribuído a um **card** ou **subtarefa**, o Firebase envia
um email automático pra essa pessoa. Roda no servidor — não depende de
ninguém estar com o app aberto.

> ⚠️ **Pré-requisito:** o projeto Firebase precisa estar no plano **Blaze**
> (pago por uso). Cloud Functions não rodam no plano gratuito Spark.
> O Blaze tem cota grátis generosa — pra esse volume o custo é ~R$0.
> Ative em: https://console.firebase.google.com/project/walkerskambam/usage/details

---

## Passo 1 — Instalar a CLI do Firebase (uma vez por máquina)

No PowerShell/CMD:

```
npm install -g firebase-tools
firebase login
```

(`firebase login` abre o navegador pra você entrar com a conta Google dona do projeto.)

---

## Passo 2 — Instalar dependências da função

Na pasta do projeto (onde está o `firebase.json`):

```
cd functions
npm install
cd ..
```

---

## Passo 3 — Criar uma "Senha de app" do Gmail

A função envia pelo seu Gmail. O Gmail não aceita sua senha normal — precisa
de uma **Senha de app** (App Password), que exige a verificação em 2 etapas ligada.

1. Ative a verificação em 2 etapas: https://myaccount.google.com/signinoptions/two-step-verification
2. Crie a senha de app: https://myaccount.google.com/apppasswords
   - Nome sugerido: `Walkers Kanban`
   - Vai gerar **16 caracteres** (ex: `abcd efgh ijkl mnop`) — copie (pode tirar os espaços).

---

## Passo 4 — Guardar as credenciais como secrets

```
firebase functions:secrets:set EMAIL_USER
```
→ cole seu endereço Gmail (ex: `voce@gmail.com`) e Enter.

```
firebase functions:secrets:set EMAIL_PASS
```
→ cole a **senha de app** de 16 caracteres (sem espaços) e Enter.

---

## Passo 5 — Fazer o deploy

```
firebase deploy --only functions
```

Pronto! A partir daí, toda vez que um responsável for definido num card ou
subtarefa, a pessoa recebe o email.

> 💡 Bônus: pra publicar também as regras do Firestore por aqui (em vez de
> colar no Console), rode:
> ```
> firebase deploy --only firestore:rules
> ```

---

## Como testar

1. Garanta que os **membros do workspace têm email** (eles entram com a conta Google, então o email já fica registrado).
2. Abra um card e defina o **Responsável** como outro membro.
3. Em alguns segundos a função roda e o email chega. Veja os logs com:
   ```
   firebase functions:log
   ```

## Detalhes técnicos

- Função: `functions/index.js` → `notifyAssignment`
- Gatilho: update em `workspaces/{wsId}/kanban/main`
- Lógica: compara o estado anterior x novo dos `cards` (e subtarefas) e dispara
  só quando o campo `assignee` **muda** — então não manda email repetido.
- O email do destinatário é resolvido pelo `displayName`/`email` na lista de
  membros do workspace.

### Observações
- Se você se **auto-atribuir**, também recebe o email (a função não sabe quem
  fez a edição). Se quiser desligar isso depois, dá pra carimbar o editor — me avise.
- Mudar a região/remetente, formato do email, etc. é tudo no `functions/index.js`.

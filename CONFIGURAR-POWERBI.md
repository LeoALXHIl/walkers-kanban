# 📊 Integração com Power BI (endpoint JSON)

A Cloud Function expõe seus dados **já achatados** (1 linha por card/subtarefa/cliente)
num endpoint HTTP. O Power BI consome via **Obter Dados → Web** e atualiza sozinho.

> Pré-requisito: plano **Blaze** (o mesmo das functions de email). Se já fez aquele
> setup, aqui só falta definir 1 segredo e fazer o deploy de novo.

---

## Passo 1 — Definir a chave secreta do endpoint
No PowerShell, na pasta do projeto:

```
firebase functions:secrets:set POWERBI_KEY
```
→ digite uma senha forte qualquer (ex: `wk_p0w3rbi_2026_xYz`) e Enter.
Essa é a chave que vai na URL — guarde.

## Passo 2 — Deploy
```
firebase deploy --only functions
```
No fim, o terminal mostra a URL da função `powerbi`, tipo:
```
https://us-central1-walkerskambam.cloudfunctions.net/powerbi
```

## Passo 3 — Descobrir o ID do seu workspace
Abra no navegador (trocando a chave):
```
https://us-central1-walkerskambam.cloudfunctions.net/powerbi?key=SUA_CHAVE&table=workspaces
```
Vai listar `[{ "id": "ws_xxxx", "nome": "..." }]`. Copie o `id`.
> Se você só tem 1 workspace, pode até omitir o `ws` na URL — ele pega sozinho.

## Passo 4 — Conectar no Power BI
1. Power BI Desktop → **Página Inicial → Obter Dados → Web**
2. Cole a URL (uma por tabela):

   **Cards** (1 linha por card):
   ```
   https://us-central1-walkerskambam.cloudfunctions.net/powerbi?key=SUA_CHAVE&ws=ws_xxxx&table=cards
   ```
   **Subtarefas:**
   ```
   ...?key=SUA_CHAVE&ws=ws_xxxx&table=subtarefas
   ```
   **Clientes:**
   ```
   ...?key=SUA_CHAVE&ws=ws_xxxx&table=clientes
   ```
3. O Power BI reconhece o JSON → clique em **Para Tabela** / **To Table** e expanda as colunas.
4. Repita pra cada tabela que quiser.

## Passo 5 — Atualização automática
- No Power BI Desktop: **Atualizar** quando quiser.
- Publicando no **Power BI Service** (nuvem): configure **Atualização agendada**
  (ex: de hora em hora). O endpoint sempre devolve o dado mais recente do Firestore.

---

## Colunas que vêm em cada tabela

**cards:** id, cliente, status, board, prioridade, responsavel, vencimento,
criado_em, idade_dias, atrasado, arquivado, favorito, subtarefas_total,
subtarefas_concluidas, subtarefas_abertas, comentarios, anexos, tags, plataformas

**subtarefas:** card_id, cliente, status_card, subtarefa, responsavel, status,
vencimento, concluida

**clientes:** cliente, telefone, email, valor_hora, total_faturado, arquivado,
cards_total, cards_abertos

---

## Segurança
- A chave (`POWERBI_KEY`) protege o endpoint — **não compartilhe a URL com a chave**.
- Pra trocar a chave: rode `firebase functions:secrets:set POWERBI_KEY` de novo + deploy.
- Os dados saem só-leitura; o endpoint nunca grava nada.

## Dica
Se preferir tudo numa planilha em vez do Power BI, dá pra abrir essas URLs no
Excel também (Dados → Da Web). Mesmos dados.

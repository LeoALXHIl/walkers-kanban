# 🌐 Portal do Cliente

O cliente acompanha o status da implementação por um **link único**, no
navegador, **sem login**. Você controla o que aparece, pode pôr PIN, e o
cliente pode comentar e aprovar etapas.

## Como funciona (resumo)
- No app: **Clientes → abra um cliente → aba 🌐 Portal → Gerar link público**
- Escolha os campos visíveis, PIN, validade, comentários/aprovações e branding
- Copie o link e mande pro cliente (ex: `https://walkerskambam.web.app/#/c/nome-do-cliente-ab12`)
- O cliente abre, vê o progresso em tempo real, comenta e aprova etapas
- As aprovações e comentários voltam pra você na própria aba Portal

## Testar agora (sem publicar nada)
No app, na aba Portal de um cliente com link gerado, clique em **👁 Pré-visualizar**.
Você vê exatamente o que o cliente veria. Pra voltar, clique em **← Sair da prévia**.

---

## ⚠️ Pra o link funcionar PRO CLIENTE (1x, no deploy)
O cliente abre o link no navegador, então o app precisa estar **publicado na web**
(Firebase Hosting). Isso é parte do deploy:

1. Garanta o **plano Blaze** (mesmo das outras functions)
2. Rode o **`deploy.bat`**
3. Quando ele perguntar **"Publicar também o Portal do Cliente (site)? (S/N)"** → responda **S**
   - Ele compila o app e publica em `https://walkerskambam.web.app`
4. Pronto — os links `https://walkerskambam.web.app/#/c/...` passam a abrir pra qualquer pessoa

> Também republica as **regras do Firestore** (necessárias: leitura pública do
> portal + cliente conseguir comentar/aprovar). Se você já publicou as regras
> antes, rode de novo porque elas mudaram.

## Sobre os dados
- O portal mostra um **retrato (snapshot)** dos cards do cliente, atualizado pelo
  seu app sempre que você abre a aba Portal ou mexe nos cards com ela aberta.
- O cliente **nunca** acessa seus dados privados — só o snapshot do que você liberou.

## Privacidade / segurança
- Campo **"Comentários internos"**: cuidado, expõe suas notas internas. Deixe
  desligado se não quiser que o cliente leia.
- **PIN**: ative pra exigir senha de acesso.
- **Validade**: o link pode expirar em 30/90 dias ou data específica.
- **Revogar**: na aba Portal, botão 🚫 Revogar mata o link na hora.

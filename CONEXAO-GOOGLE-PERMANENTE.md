# 🔐 Conexão Google permanente (não expira)

A partir da **v4.24.4**, o botão principal em **Integrações → Conexão Google**
conecta no **modo permanente** (refresh_token). Você autoriza **uma vez** no
navegador e o app renova o token sozinho, sem mais aquelas reconexões de 1h.

## Como usar (você e seus clientes)
1. Vá em **Integrações**
2. Clique em **🔐 Conectar com Google (não expira)**
3. Abre o navegador → se aparecer "app não verificado", clique em
   **Avançado → Acessar Walkers Kanban Desktop → Continuar** e aceite
4. Pronto. Aparece "🎉 Conexão permanente ativa".

> O modo antigo de 1h virou um link discreto ("Usar modo temporário de 1h"),
> só pra emergência.

---

## ⚠️ PASSO OBRIGATÓRIO (uma vez, no Google Cloud) — senão expira em 7 dias

O Google tem uma regra: enquanto a "tela de consentimento OAuth" estiver em
modo **Testing**, o refresh_token **expira em 7 dias**. Pra ser realmente
permanente, publique pra **Production**:

1. Abra: https://console.cloud.google.com/auth/overview?project=walkerskambam
   (ou "APIs e serviços" → "Tela de permissão OAuth")
2. Em **Público / Publishing status**, se estiver "Testing", clique em
   **PUBLICAR APP / PUBLISH APP** → confirme.
3. Status deve ficar **In production** (Em produção).

Pode aparecer um aviso de "verificação". Para o seu uso (você + clientes), você
pode usar mesmo sem a verificação completa — os usuários só veem a tela de
"app não verificado" uma vez ao conectar (passo 3 acima). Os refresh_tokens
**param de expirar** assim que sai do modo Testing.

> Se você não publicar, vai funcionar liso por ~7 dias e depois pedir pra
> reconectar de novo. Com Production, é definitivo.

---

## Como tirar o acesso (se precisar)
- No app: **Integrações → 🔌 Desconectar**
- Na conta Google: https://myaccount.google.com/permissions → revogue
  "Walkers Kanban Desktop".

## Por baixo dos panos
- Fluxo OAuth Desktop (PKCE + loopback) → recebe `refresh_token`
- O refresh_token fica **criptografado** no processo principal do Electron
- Na inicialização e ~5 min antes de expirar, o app troca por um access_token
  novo **silenciosamente** (sem popup)

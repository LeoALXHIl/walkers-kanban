# Configurar Firestore Security Rules (v4.19+)

A partir do **v4.19** (multi-user), o Walkers usa um novo path no Firestore:
- `users/{uid}/profile/main` — seu perfil + lista de workspaces
- `workspaces/{wsId}` — dados compartilhados entre membros do workspace
- `workspaces/{wsId}/kanban/main` — kanban data do workspace

**Você precisa atualizar suas Firestore Rules pra liberar esses paths.**

## Passo a passo (30 segundos)

1. Abre: <https://console.firebase.google.com/project/walkerskambam/firestore/rules>
2. Substitui TODO o conteúdo do editor pelo conteúdo do arquivo `firestore.rules` (na raiz deste repo)
3. Click **Publish** (canto superior direito)
4. Aguarda 10-30 segundos pra propagar
5. Recarrega o Walkers — o workspace switcher deve aparecer normalmente

## Conteúdo das regras (cópia rápida)

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /workspaces/{wsId} {
      allow read: if request.auth != null
                  && request.auth.uid in resource.data.memberUids;
      allow create: if request.auth != null
                    && request.resource.data.ownerUid == request.auth.uid
                    && request.auth.uid in request.resource.data.memberUids;
      allow update: if request.auth != null
                    && request.auth.uid in resource.data.memberUids;
      allow delete: if request.auth != null
                    && resource.data.ownerUid == request.auth.uid;
    }

    match /workspaces/{wsId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid in get(/databases/$(database)/documents/workspaces/$(wsId)).data.memberUids;
    }
  }
}
```

## O que cada regra faz

- **users/{uid}**: só o próprio usuário acessa seu perfil (e o backup legado em `kanban`)
- **workspaces/{wsId}**: qualquer **membro** do workspace lê/escreve; só o **owner** pode deletar
- **workspaces/{wsId}/kanban/main**: idem — só membros do workspace acessam

Resultado: **dois usuários no mesmo workspace** veem o mesmo board; **usuários em workspaces diferentes** ficam isolados.

## Se algo der errado

Se a aba do Firestore não carregar as rules ou der erro ao publicar:
- Confirma que tá no projeto certo (deve aparecer `walkerskambam` no canto superior esquerdo)
- Confirma que tá logado com a conta dona do projeto
- Se for primeira vez, pode ser que o Firestore esteja em modo "Test mode" (permitia tudo). Ao publicar essas rules, vira "Production mode" com as restrições.

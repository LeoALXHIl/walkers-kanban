import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, type DocumentReference } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCqoVXms7wjEs_Ja8Tr8FzGXp_FSuiZd8g',
  authDomain: 'walkerskambam.firebaseapp.com',
  projectId: 'walkerskambam',
  storageBucket: 'walkerskambam.firebasestorage.app',
  messagingSenderId: '192188793356',
  appId: '1:192188793356:web:036dd4c82efa8531582429'
};

export const FIREBASE_API_KEY = firebaseConfig.apiKey;
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Google OAuth scopes. Requested during signInWithPopup; consentidos por sessão.
// Gmail está DESATIVADO: gmail.readonly/gmail.send são scopes RESTRITOS e exigem
// avaliação de segurança CASA (cara/demorada) na verificação OAuth. Mantemos só
// Calendar (scope "sensível", revisão simples). Para reativar Gmail, descomente
// as linhas e passe pela verificação CASA do Google.
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events'
  // 'https://www.googleapis.com/auth/gmail.readonly',
  // 'https://www.googleapis.com/auth/gmail.send'
];

// Flag única: features de Gmail ficam ocultas enquanto o scope não estiver
// verificado (CASA). Vire para `true` ao reativar os scopes acima.
export const GMAIL_ENABLED = false;

// ─── Embedded Desktop OAuth Client (for distribution to end-users) ───
// Cole aqui o Client ID do seu **Desktop App** OAuth (criado no Google Cloud Console).
// Quando preenchido, seus usuários veem só "Conectar Google" — sem precisar configurar nada.
// Deixe vazio durante dev pra testar com o input manual.
//
// COMO PEGAR:
//   1. https://console.cloud.google.com/apis/credentials?project=walkerskambam
//   2. + CRIAR CREDENCIAIS → ID do cliente OAuth → Aplicativo para computador
//   3. Nome: "Walkers Kanban"
//   4. Copia o Client ID e cola abaixo
//   5. Configura OAuth Consent Screen (External + Test Users até 100 ou submit pra verification)
export const EMBEDDED_GOOGLE_CLIENT_ID = '192188793356-u94m08snjrhbpg7ashjt8vtu7vn3sgco.apps.googleusercontent.com';

export const fbApp = initializeApp(firebaseConfig);
// initializeFirestore (vs getFirestore) lets us pass settings — crucial: ignore undefined
// values to prevent "Unsupported field value: undefined" errors on setDoc/updateDoc.
export const db = initializeFirestore(fbApp, { ignoreUndefinedProperties: true });
export const auth = getAuth(fbApp);

export function userKanbanDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'kanban', 'main');
}

// ─── Multi-user / Workspace paths (v4.19+) ────────────────────
export function userProfileDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'profile', 'main');
}
export function workspaceDoc(wsId: string): DocumentReference {
  return doc(db, 'workspaces', wsId);
}
export function workspaceDataDoc(wsId: string): DocumentReference {
  return doc(db, 'workspaces', wsId, 'kanban', 'main');
}

export function friendlyAuthError(e: any): string {
  const code = (e && e.code) || '';
  if (code.includes('user-not-found')) return 'Usuário não encontrado.';
  if (code.includes('wrong-password')) return 'Senha incorreta.';
  if (code.includes('invalid-credential')) return 'Email ou senha incorretos.';
  if (code.includes('email-already-in-use')) return 'Email já cadastrado. Tente entrar.';
  if (code.includes('weak-password')) return 'Senha muito fraca (mín. 6 caracteres).';
  if (code.includes('invalid-email')) return 'Email inválido.';
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return '';
  if (code.includes('popup-blocked')) return 'Popup bloqueado. Permita popups e tente novamente.';
  if (code.includes('network-request-failed')) return 'Sem conexão. Verifique sua internet.';
  if (code.includes('auth/unauthorized-domain')) return 'Domínio não autorizado no Firebase Console.';
  return (e && e.message) || 'Erro inesperado.';
}

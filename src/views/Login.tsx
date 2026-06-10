import { useState, type FormEvent } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, friendlyAuthError, GOOGLE_SCOPES } from '@/services/firebase';
import { useAuth } from '@/store/auth';

type Mode = 'login' | 'signup';

// Card de autenticação isolado — reutilizado tanto na tela cheia (Login) quanto
// embutido na landing de vendas (Landing).
export function AuthCard({ initialMode = 'login' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(''); setSuccess('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setBusy(true);
    try {
      if (mode === 'signup') {
        if (password !== confirm) { setError('As senhas não coincidem.'); setBusy(false); return; }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (ex: any) {
      setError(friendlyAuthError(ex));
      setBusy(false);
    }
  };

  const setGoogleToken = useAuth(s => s.setGoogleToken);

  const google = async () => {
    setError(''); setSuccess(''); setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      // Request Calendar + Gmail scopes so we can integrate without a second consent
      GOOGLE_SCOPES.forEach(s => provider.addScope(s));
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      // Capture OAuth access token for Google APIs (Calendar/Gmail)
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (cred?.accessToken) {
        setGoogleToken(cred.accessToken, 3600);
      }
    } catch (ex: any) {
      setError(friendlyAuthError(ex));
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) { setError('Digite seu email primeiro.'); return; }
    setError(''); setSuccess('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('✓ Email de recuperação enviado!');
    } catch (ex: any) {
      setError(friendlyAuthError(ex));
    }
  };

  return (
    <div className="auth-card" id="entrar">
      <div className="auth-logo">W</div>
      <h1 className="auth-title">Walkers</h1>
      <p className="auth-sub">{mode === 'signup' ? 'Crie sua conta gratuita' : 'Entre pra acessar seu kanban'}</p>

      <div className="auth-tabs">
        <button type="button" className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => switchMode('login')}>Entrar</button>
        <button type="button" className={`auth-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => switchMode('signup')}>Criar conta</button>
      </div>

      <form onSubmit={submit}>
        <input
          type="email"
          className="auth-input"
          placeholder="Seu email"
          aria-label="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="auth-input"
          placeholder="Sua senha (mín. 6)"
          aria-label="Senha (mínimo 6 caracteres)"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {mode === 'signup' && (
          <input
            type="password"
            className="auth-input"
            placeholder="Confirme a senha"
            aria-label="Confirme a senha"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
          />
        )}
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        {!error && !success && <div className="auth-error">&nbsp;</div>}
        <button type="submit" className="auth-btn auth-btn-primary" disabled={busy}>
          {mode === 'signup' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      <div className="auth-divider"><span>ou</span></div>

      <button type="button" className="auth-btn auth-btn-google" onClick={google} disabled={busy}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continuar com Google
      </button>

      <button type="button" className="auth-link" onClick={forgot}>Esqueci minha senha</button>
    </div>
  );
}

export function Login() {
  return (
    <div className="auth-overlay">
      <AuthCard />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { isWebMode } from '@/services/browserBridge';

// Banner mostrado APENAS na versão web em telas pequenas. Avisa que o app é
// otimizado pra desktop e, quando o navegador oferece, permite "instalar" como
// PWA (atalho na tela inicial). Dispensável — a escolha persiste no localStorage.
// No Electron nunca aparece (isWebMode() é false).

const DISMISS_KEY = 'walkers:mobileBannerDismissed';
const MOBILE_MAX_WIDTH = 768;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH;
}

export function MobileBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  );
  const [mobile, setMobile] = useState(isMobileViewport);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onResize = () => setMobile(isMobileViewport());
    window.addEventListener('resize', onResize);

    // beforeinstallprompt: o navegador permite instalar como PWA. Guardamos o
    // evento pra disparar no clique do usuário (não pode ser automático).
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  if (!isWebMode() || !mobile || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') dismiss();
    setInstallEvent(null);
  };

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: 'var(--bg2, #1b1b27)',
        borderTop: '1px solid var(--border, #2c2c3a)',
        boxShadow: '0 -4px 16px rgba(0,0,0,.25)',
        fontSize: 13, color: 'var(--text, #e8e8f0)'
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.35 }}>
        📱 O Walkers é otimizado para <strong>desktop</strong>. No celular algumas
        telas ficam apertadas — para a melhor experiência, use um computador.
      </span>
      {installEvent && (
        <button
          onClick={install}
          style={{
            flex: '0 0 auto', padding: '7px 12px', borderRadius: 8, border: 'none',
            background: 'var(--accent, #7c3aed)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Instalar
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dispensar aviso"
        style={{
          flex: '0 0 auto', padding: '7px 10px', borderRadius: 8,
          border: '1px solid var(--border, #2c2c3a)', background: 'transparent',
          color: 'var(--text2, #8b8b9e)', fontSize: 13, cursor: 'pointer'
        }}
      >
        Entendi
      </button>
    </div>
  );
}

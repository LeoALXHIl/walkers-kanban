// Wrapper around the browser's SpeechRecognition API.
// Works out-of-the-box in regular Chrome; in Electron it requires Chromium's
// recognition engine to be available. We gracefully report unsupported so the
// UI can fall back to a manual textarea.

export interface VoiceCallbacks {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export interface VoiceController {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function isVoiceSupported(): boolean {
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startVoice(callbacks: VoiceCallbacks): VoiceController {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) {
    callbacks.onError?.('Reconhecimento de voz não suportado neste sistema. Tente digitar manualmente.');
    return { start: () => {}, stop: () => {}, abort: () => {} };
  }

  const recognition = new SR();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let accumulated = '';

  recognition.onstart = () => callbacks.onStart?.();
  recognition.onresult = (event: any) => {
    let interim = '';
    let newFinal = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) newFinal += t;
      else interim += t;
    }
    if (newFinal) accumulated = (accumulated + ' ' + newFinal).trim();
    callbacks.onInterim?.((accumulated + ' ' + interim).trim());
    if (newFinal) callbacks.onFinal?.(accumulated);
  };
  recognition.onerror = (e: any) => {
    const msg = mapError(e.error);
    callbacks.onError?.(msg);
  };
  recognition.onend = () => callbacks.onEnd?.();

  return {
    start: () => { try { recognition.start(); } catch (e: any) { callbacks.onError?.(e.message || 'erro ao iniciar'); } },
    stop:  () => { try { recognition.stop(); } catch {} },
    abort: () => { try { recognition.abort(); } catch {} }
  };
}

function mapError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permissão de microfone negada. Habilite nas configurações do sistema.';
    case 'no-speech':
      return 'Nada foi captado. Tente de novo falando mais perto do microfone.';
    case 'audio-capture':
      return 'Microfone não encontrado.';
    case 'network':
      return 'Sem internet — reconhecimento de voz precisa de conexão.';
    case 'aborted':
      return '';
    default:
      return `Erro de reconhecimento: ${code}`;
  }
}

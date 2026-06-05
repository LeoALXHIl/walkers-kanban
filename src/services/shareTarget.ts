import type { NewCardSeed } from '@/store/ui';

// Web Share Target (Sprint 5): quando o usuário compartilha algo (ex: uma mensagem
// do WhatsApp) para o PWA instalado, o Android abre o app em "/?title=&text=&url=".
// Transformamos esses parâmetros num seed de card e limpamos a URL para não reabrir
// o card a cada refresh/re-render. Retorna null quando não há nada compartilhado.
export function consumeSharedCardSeed(): NewCardSeed | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const title = (p.get('title') || '').trim();
  const text = (p.get('text') || '').trim();
  const url = (p.get('url') || '').trim();
  if (!title && !text && !url) return null;

  // Limpa os parâmetros já na primeira leitura (idempotente: a 2ª chamada vê URL limpa).
  try {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  } catch {}

  let name = title;
  let note = '';
  if (!name) {
    // Caso típico do WhatsApp (só vem `text`): 1ª linha vira o nome, o resto a nota.
    const lines = text.split('\n');
    name = (lines[0] || '').slice(0, 120).trim();
    note = lines.slice(1).join('\n').trim();
  } else {
    note = text;
  }
  if (url) note = note ? `${note}\n${url}` : url;
  return { name: name || 'Compartilhado', note: note || undefined };
}

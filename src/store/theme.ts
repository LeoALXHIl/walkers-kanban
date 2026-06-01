import { create } from 'zustand';

export type ThemeId =
  | 'system'
  | 'dark-purple'
  | 'light'
  | 'dark-blue'
  | 'dark-green'
  | 'dracula'
  | 'nord'
  | 'amoled';

export const THEMES: Array<{ id: ThemeId; label: string; emoji: string; dark: boolean }> = [
  { id: 'system',      label: 'Seguir sistema',  emoji: '💻', dark: true  },
  { id: 'dark-purple', label: 'Roxo (padrão)',    emoji: '🟣', dark: true  },
  { id: 'light',       label: 'Claro',            emoji: '☀️', dark: false },
  { id: 'dark-blue',   label: 'Azul Escuro',      emoji: '🔵', dark: true  },
  { id: 'dark-green',  label: 'Verde Escuro',     emoji: '🟢', dark: true  },
  { id: 'dracula',     label: 'Drácula',          emoji: '🧛', dark: true  },
  { id: 'nord',        label: 'Nord',             emoji: '❄️', dark: true  },
  { id: 'amoled',      label: 'AMOLED',           emoji: '⚫', dark: true  }
];

const THEME_KEY = 'walkers.theme.v1';
const ACCENT_KEY = 'walkers.accent.v1';
const DENSITY_KEY = 'walkers.density.v1';
const SCALE_KEY = 'walkers.uiScale.v1';

export type Density = 'compact' | 'normal' | 'comfortable';
// Tamanho da interface. 'auto' = adapta sozinho à resolução do PC via media queries.
export type UiScale = 'auto' | '0.9' | '1' | '1.1' | '1.25';

export const UI_SCALES: Array<{ v: UiScale; label: string; desc: string }> = [
  { v: 'auto', label: '🤖 Automático', desc: 'Adapta sozinho à resolução do monitor' },
  { v: '0.9',  label: '90%',          desc: 'Compacto — cabe mais coisa na tela' },
  { v: '1',    label: '100%',         desc: 'Padrão' },
  { v: '1.1',  label: '110%',         desc: 'Grande — texto mais confortável' },
  { v: '1.25', label: '125%',         desc: 'Extra grande — pra monitor 4K' }
];

export const PRESET_ACCENTS = [
  '#7c5cfc', // purple (default)
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#38bdf8', // sky
  '#a855f7'  // violet
];

interface ThemeState {
  theme: ThemeId;
  accent: string | null;     // null = use theme default
  density: Density;
  uiScale: UiScale;
  setTheme: (t: ThemeId) => void;
  setAccent: (color: string | null) => void;
  setDensity: (d: Density) => void;
  setUiScale: (s: UiScale) => void;
  init: () => void;
}

function applyTheme(theme: ThemeId, accent: string | null): void {
  const root = document.documentElement;
  let resolved: string = theme;
  if (theme === 'system') {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    resolved = prefersLight ? 'light' : 'dark-purple';
  }
  root.setAttribute('data-theme', resolved);
  if (accent) root.style.setProperty('--accent', accent);
  else root.style.removeProperty('--accent');
}

function applyDensity(d: Density): void {
  document.documentElement.setAttribute('data-density', d);
}

// Calcula o fator de zoom automático a partir da largura da janela.
function autoZoomFor(width: number): number {
  if (width >= 3200) return 1.35;
  if (width >= 2400) return 1.20;
  if (width >= 1920) return 1.12;
  if (width >= 1600) return 1.06;
  if (width <= 1280) return 0.95;
  return 1;
}

let resizeListener: (() => void) | null = null;

function applyUiScale(s: UiScale): void {
  const api = (window as any).walkersAPI;
  if (!api?.setZoom) return; // fora do Electron, ignora
  // Limpa o listener anterior (relevante quando troca de 'auto' pra fixo)
  if (resizeListener) { window.removeEventListener('resize', resizeListener); resizeListener = null; }
  if (s === 'auto') {
    const recalc = () => api.setZoom(autoZoomFor(window.innerWidth));
    recalc();
    resizeListener = recalc;
    window.addEventListener('resize', recalc);
  } else {
    api.setZoom(parseFloat(s));
  }
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: loadStored<ThemeId>(THEME_KEY, 'dark-purple'),
  accent: loadStored<string | null>(ACCENT_KEY, null),
  density: loadStored<Density>(DENSITY_KEY, 'normal'),
  uiScale: loadStored<UiScale>(SCALE_KEY, 'auto'),
  setTheme: (t) => {
    set({ theme: t });
    localStorage.setItem(THEME_KEY, JSON.stringify(t));
    applyTheme(t, get().accent);
  },
  setAccent: (color) => {
    set({ accent: color });
    localStorage.setItem(ACCENT_KEY, JSON.stringify(color));
    applyTheme(get().theme, color);
  },
  setDensity: (d) => {
    set({ density: d });
    localStorage.setItem(DENSITY_KEY, JSON.stringify(d));
    applyDensity(d);
  },
  setUiScale: (s) => {
    set({ uiScale: s });
    localStorage.setItem(SCALE_KEY, JSON.stringify(s));
    applyUiScale(s);
  },
  init: () => {
    applyTheme(get().theme, get().accent);
    applyDensity(get().density);
    applyUiScale(get().uiScale);
    // React to OS theme changes when user is on "system"
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => { if (get().theme === 'system') applyTheme('system', get().accent); };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if ((mq as any).addListener) (mq as any).addListener(handler);
  }
}));

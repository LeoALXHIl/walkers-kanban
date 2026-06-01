// Saved filter presets per board. Stored in localStorage.
import type { Platform, Priority } from '@/types';

const KEY = 'walkers.filterPresets.v1';

export interface FilterPreset {
  id: string;
  name: string;
  emoji?: string;
  boardId: string;
  q?: string;
  plat?: Platform | '';
  prio?: Priority | '';
}

interface Store { presets: FilterPreset[]; }

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { presets: [] };
    const v = JSON.parse(raw);
    if (!v || !Array.isArray(v.presets)) return { presets: [] };
    return v;
  } catch { return { presets: [] }; }
}

function save(s: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getPresetsForBoard(boardId: string | undefined): FilterPreset[] {
  if (!boardId) return [];
  return load().presets.filter(p => p.boardId === boardId);
}

export function addPreset(p: Omit<FilterPreset, 'id'>): FilterPreset {
  const s = load();
  const preset: FilterPreset = { id: 'fp_' + Math.random().toString(36).slice(2, 9), ...p };
  s.presets.push(preset);
  save(s);
  return preset;
}

export function deletePreset(id: string): void {
  const s = load();
  s.presets = s.presets.filter(p => p.id !== id);
  save(s);
}

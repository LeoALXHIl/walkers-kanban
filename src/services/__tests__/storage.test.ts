import { describe, it, expect } from 'vitest';
import { dueInfo, fmt, migrateData, DEFAULT_DATA } from '@/services/storage';

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

describe('dueInfo', () => {
  it('null quando sem data', () => {
    expect(dueInfo(null)).toBeNull();
    expect(dueInfo(undefined)).toBeNull();
  });
  it('marca hoje', () => {
    const info = dueInfo(today());
    expect(info?.cls).toBe('due-today');
    expect(info?.label).toBe('Hoje');
  });
  it('marca passado como atrasado', () => {
    const info = dueInfo('2020-01-01');
    expect(info?.cls).toBe('due-late');
    expect(info?.label.startsWith('Atrasado')).toBe(true);
  });
});

describe('fmt', () => {
  it('vazio quando sem timestamp', () => {
    expect(fmt(undefined)).toBe('');
    expect(fmt(0)).toBe('');
  });
});

describe('migrateData', () => {
  it('preenche defaults a partir de objeto vazio', () => {
    const d = migrateData({});
    expect(d.version).toBe(3);
    expect(d.cols.length).toBe(DEFAULT_DATA.cols.length);
    expect(d.cards).toEqual([]);
    expect(d.activeBoardId).toBeTruthy();
    expect(Array.isArray(d.boards)).toBe(true);
  });
});

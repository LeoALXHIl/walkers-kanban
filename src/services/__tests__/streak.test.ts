import { describe, it, expect } from 'vitest';
import { diffDays, weekId, effectiveStreak, recordActivity, todayStr } from '@/services/streak';
import { emptyData } from '@/services/storage';
import type { Streak } from '@/types';

function streak(over: Partial<Streak>): Streak {
  return { current: 0, longest: 0, lastActivityDay: null, startedAt: null, lastWrapShownWeek: null, ...over };
}

describe('diffDays', () => {
  it('calcula diferença em dias (com sinal)', () => {
    expect(diffDays('2026-01-01', '2026-01-02')).toBe(1);
    expect(diffDays('2026-01-10', '2026-01-01')).toBe(-9);
    expect(diffDays('2026-03-01', '2026-03-01')).toBe(0);
  });
});

describe('weekId', () => {
  it('formato ISO e estável dentro da mesma semana', () => {
    const seg = new Date(2026, 0, 5); // segunda 05/01/2026
    const qua = new Date(2026, 0, 7);
    expect(weekId(seg)).toMatch(/^\d{4}-W\d{2}$/);
    expect(weekId(seg)).toBe(weekId(qua));
  });
});

describe('effectiveStreak', () => {
  it('zera quando inativo há mais de 1 dia', () => {
    expect(effectiveStreak(undefined)).toBe(0);
    expect(effectiveStreak(streak({ current: 5, lastActivityDay: '2000-01-01' }))).toBe(0);
  });
  it('mantém quando ativo hoje', () => {
    expect(effectiveStreak(streak({ current: 3, lastActivityDay: todayStr() }))).toBe(3);
  });
});

describe('recordActivity', () => {
  it('inicia streak e registra atividade do dia', () => {
    const data = emptyData();
    recordActivity(data, 'create');
    expect(data.streak!.current).toBe(1);
    expect(data.activity![todayStr()].cardsCreated).toBe(1);
    expect(data.activity![todayStr()].total).toBe(1);
  });
  it('não dobra o streak em duas atividades no mesmo dia', () => {
    const data = emptyData();
    recordActivity(data, 'create');
    recordActivity(data, 'move');
    expect(data.streak!.current).toBe(1);
    expect(data.activity![todayStr()].total).toBe(2);
  });
});

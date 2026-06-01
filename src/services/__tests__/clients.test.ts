import { describe, it, expect } from 'vitest';
import { clientKey, aggregateClient, allClients } from '@/services/clients';
import { emptyData } from '@/services/storage';
import type { AppData, Card } from '@/types';

function makeCard(over: Partial<Card>): Card {
  return {
    id: 'id_' + Math.random().toString(36).slice(2),
    cid: 'c1',
    name: 'Cliente',
    plat: [],
    prio: 'med',
    color: '#7c5cfc',
    note: '',
    desc: '',
    assignee: null,
    due: null,
    tagIds: [],
    subtasks: [],
    attachments: [],
    comments: [],
    ts: Date.now(),
    ...over
  };
}

describe('clientKey', () => {
  it('normaliza espaços e caixa', () => {
    expect(clientKey('  Maria Silva ')).toBe('maria silva');
    expect(clientKey('JOÃO')).toBe('joão');
  });
  it('tolera vazio/undefined', () => {
    expect(clientKey('')).toBe('');
    expect(clientKey(undefined as unknown as string)).toBe('');
  });
});

describe('aggregateClient', () => {
  it('conta ativos e concluídos pela última coluna', () => {
    const data: AppData = emptyData();
    const lastCol = data.cols[data.cols.length - 1].id; // 'c4'
    data.cards = [
      makeCard({ name: 'Acme', cid: 'c1' }),
      makeCard({ name: 'Acme', cid: lastCol }),
      makeCard({ name: 'Outro', cid: 'c1' })
    ];
    const s = aggregateClient('Acme', data);
    expect(s.totalCards).toBe(2);
    expect(s.doneCards).toBe(1);
    expect(s.activeCards).toBe(1);
  });

  it('allClients deriva clientes únicos (case-insensitive)', () => {
    const data: AppData = emptyData();
    data.cards = [makeCard({ name: 'Acme' }), makeCard({ name: 'acme' }), makeCard({ name: 'Beta' })];
    const keys = allClients(data).map(c => c.key).sort();
    expect(keys).toEqual(['acme', 'beta']);
  });
});

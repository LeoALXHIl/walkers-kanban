// Board de exemplo (Sprint 3 — onboarding). Popula o board ATIVO com cards
// realistas de um "consultor de WhatsApp", distribuídos pelas colunas por índice.
// Tudo deletável. Inserido num único apply() → um só passo de undo, sem spam de
// webhook. Só deve ser chamado a partir de um board vazio (CTA do empty state).

import { useData } from '@/store/data';
import { genId } from '@/services/storage';
import { CARD_COLORS } from '@/services/colors';
import type { Card, Platform, Priority, Subtask } from '@/types';

function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

interface SeedCard {
  name: string;
  col: number;              // índice da coluna (clampa ao nº de colunas)
  prio: Priority;
  plat: Platform[];
  note?: string;
  dueInDays?: number;
  subtasks?: Array<{ text: string; done?: boolean }>;
}

const SEEDS: SeedCard[] = [
  {
    name: 'Maria — Boutique Bella', col: 0, prio: 'high', plat: ['wpp'], dueInDays: 3,
    note: 'Setup do catálogo no WhatsApp Business.',
    subtasks: [
      { text: 'Coletar fotos dos produtos' },
      { text: 'Montar catálogo no WhatsApp Business' },
      { text: 'Configurar mensagem de saudação' }
    ]
  },
  {
    name: 'João — Pizzaria do Zé', col: 0, prio: 'med', plat: ['wpp'], dueInDays: 6,
    note: 'Automação de pedidos pelo WhatsApp.'
  },
  {
    name: 'Studio Bella — chatbot de agendamento', col: 1, prio: 'high', plat: ['wpp', 'insta'], dueInDays: 1,
    note: 'Fluxo de agendamento automático.',
    subtasks: [
      { text: 'Mapear fluxo de agendamento', done: true },
      { text: 'Configurar respostas automáticas' },
      { text: 'Testar com 3 clientes reais' }
    ]
  },
  {
    name: 'Dra. Ana — Clínica', col: 1, prio: 'med', plat: ['wpp'],
    note: 'Lembretes de consulta + confirmação.'
  },
  {
    name: 'Tech Store — identidade visual', col: 2, prio: 'low', plat: ['wpp', 'insta'],
    note: 'Aguardando o cliente enviar logo e textos.'
  },
  {
    name: 'Salão Glamour — agendamento publicado', col: 3, prio: 'med', plat: ['wpp'],
    note: 'Link de agendamento no ar. 🎉',
    subtasks: [
      { text: 'Configurar link', done: true },
      { text: 'Treinar a recepção', done: true }
    ]
  }
];

export function seedExampleBoard(): number {
  const state = useData.getState();
  const boardId = state.data.activeBoardId;
  const cols = state.data.cols.filter((c) => !c.boardId || c.boardId === boardId);
  if (cols.length === 0) return 0;
  const colId = (i: number) => cols[Math.min(i, cols.length - 1)].id;
  const now = Date.now();

  state.apply((d) => {
    SEEDS.forEach((s, idx) => {
      const subtasks: Subtask[] = (s.subtasks || []).map((st) => ({
        id: genId(),
        text: st.text,
        done: !!st.done,
        status: st.done ? 'done' : 'todo'
      }));
      const card: Card = {
        id: genId(),
        cid: colId(s.col),
        name: s.name,
        plat: s.plat,
        prio: s.prio,
        color: CARD_COLORS[idx % CARD_COLORS.length],
        note: s.note || '',
        desc: '',
        assignee: null,
        due: s.dueInDays != null ? isoInDays(s.dueInDays) : null,
        tagIds: [],
        subtasks,
        attachments: [],
        comments: [],
        ts: now - idx * 1000,
        boardId,
        customValues: {}
      };
      d.cards.push(card);
    });
  }, 'create');

  return SEEDS.length;
}

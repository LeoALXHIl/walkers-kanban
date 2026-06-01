// AI Assistant — calls Claude API and executes tool calls against the data store.
import { useData, addCard, updateCard, moveCard, archiveCard, deleteCard, addColumn, setActiveBoard, addBoard, addSubtask, addComment, snoozeCard, toggleStarCard } from '@/store/data';
import { useUI } from '@/store/ui';
import { genId } from '@/services/storage';
import { CARD_COLORS } from '@/services/colors';
import { aggregate, weekId, todayStr } from '@/services/streak';
import { allClients } from '@/services/clients';
import type { Card, Priority, Platform } from '@/types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';
const API_KEY_STORAGE = 'walkers.anthropicApiKey';

export function getApiKey(): string {
  try { return localStorage.getItem(API_KEY_STORAGE) || ''; } catch { return ''; }
}
export function setApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(API_KEY_STORAGE, key.trim());
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {}
}

// ─── Tool definitions (Anthropic format) ─────────────────────────────────
export const TOOLS = [
  {
    name: 'list_cards',
    description: 'Lista cards do board ativo. Filtra opcionalmente por status (todos/ativos/concluidos/atrasados), prioridade, ou nome do cliente.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todos', 'ativos', 'concluidos', 'atrasados', 'arquivados', 'snoozed', 'favoritos'], description: 'Filtro de status' },
        prioridade: { type: 'string', enum: ['high', 'med', 'low'] },
        cliente: { type: 'string', description: 'Filtra cards cujo nome inclui este termo (case-insensitive)' },
        limit: { type: 'number', description: 'Quantos cards retornar (default 20)' }
      }
    }
  },
  {
    name: 'create_card',
    description: 'Cria um novo card no board ativo. Você precisa informar o nome do cliente/título e idealmente a coluna.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do card (geralmente nome do cliente)' },
        coluna: { type: 'string', description: 'Nome da coluna onde criar. Se omitido, vai pra primeira do board.' },
        prioridade: { type: 'string', enum: ['high', 'med', 'low'] },
        plataformas: { type: 'array', items: { type: 'string', enum: ['wpp', 'insta', 'msg'] } },
        nota: { type: 'string', description: 'Observação rápida' }
      },
      required: ['nome']
    }
  },
  {
    name: 'update_card',
    description: 'Atualiza campos de um card existente. Use list_cards primeiro pra pegar o id.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do card' },
        nome: { type: 'string' },
        prioridade: { type: 'string', enum: ['high', 'med', 'low'] },
        nota: { type: 'string' },
        descricao: { type: 'string' },
        responsavel: { type: 'string' },
        vencimento: { type: 'string', description: 'Data YYYY-MM-DD' }
      },
      required: ['id']
    }
  },
  {
    name: 'move_card',
    description: 'Move um card pra outra coluna do mesmo board.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        coluna: { type: 'string', description: 'Nome da coluna de destino' }
      },
      required: ['id', 'coluna']
    }
  },
  {
    name: 'archive_card',
    description: 'Arquiva um card (esconde do board, fica recuperável em Arquivo).',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'snooze_card',
    description: 'Adormece um card até uma data — ele some do board e volta sozinho.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        dias: { type: 'number', description: 'Quantos dias adormecer a partir de hoje' }
      },
      required: ['id', 'dias']
    }
  },
  {
    name: 'star_card',
    description: 'Marca/desmarca card como favorito (toggle).',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'add_subtask',
    description: 'Adiciona uma subtarefa ao card.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, texto: { type: 'string' } },
      required: ['id', 'texto']
    }
  },
  {
    name: 'add_comment',
    description: 'Adiciona um comentário ao card.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, texto: { type: 'string' } },
      required: ['id', 'texto']
    }
  },
  {
    name: 'list_columns',
    description: 'Lista as colunas do board ativo.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'list_clients',
    description: 'Lista todos os clientes com contagem de cards e atividade recente.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'list_boards',
    description: 'Lista todos os boards. Mostra qual está ativo.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'switch_board',
    description: 'Muda o board ativo. Use list_boards pra pegar o id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'get_stats',
    description: 'Estatísticas do board ativo: total de cards, ativos, concluídos, atrasados, atividade dos últimos N dias.',
    input_schema: {
      type: 'object',
      properties: { dias: { type: 'number', description: 'Janela de atividade (default 7)' } }
    }
  },
  {
    name: 'open_card',
    description: 'Abre o detalhe de um card específico na UI (mostra ao usuário).',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'switch_view',
    description: 'Troca a view atual da UI.',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['kanban', 'list', 'calendar', 'clients', 'templates', 'analytics', 'dashboard', 'inbox', 'emails', 'archive', 'snoozed', 'starred', 'mytasks', 'integrations'] }
      },
      required: ['view']
    }
  }
];

// ─── Tool executor ─────────────────────────────────────────────────────────
function findCol(name: string): string | null {
  const d = useData.getState().data;
  const cols = d.cols.filter(c => !c.boardId || c.boardId === d.activeBoardId);
  const lower = name.toLowerCase();
  return cols.find(c => c.name.toLowerCase() === lower)?.id
      || cols.find(c => c.name.toLowerCase().includes(lower))?.id
      || null;
}

function summarizeCard(c: Card) {
  return {
    id: c.id, nome: c.name, coluna_id: c.cid, prio: c.prio, plat: c.plat,
    vencimento: c.due, responsavel: c.assignee, arquivado: c.archived,
    favorito: c.starred, snoozed: c.snoozedUntil ? new Date(c.snoozedUntil).toISOString().slice(0,10) : undefined,
    subtarefas: `${c.subtasks.filter(s => s.done).length}/${c.subtasks.length}`,
    comentarios: c.comments.length,
    criado_em: c.ts ? new Date(c.ts).toISOString().slice(0,10) : undefined
  };
}

export async function executeTool(name: string, input: any): Promise<any> {
  const state = useData.getState();
  const d = state.data;
  const boardCols = d.cols.filter(c => !c.boardId || c.boardId === d.activeBoardId);
  const boardCards = d.cards.filter(c => !c.boardId || c.boardId === d.activeBoardId);
  const lastColId = boardCols[boardCols.length - 1]?.id;
  const now = Date.now();

  switch (name) {
    case 'list_cards': {
      let list = boardCards.slice();
      const status: string = input.status || 'ativos';
      if (status === 'ativos') list = list.filter(c => !c.archived && c.cid !== lastColId && !(c.snoozedUntil && c.snoozedUntil > now));
      else if (status === 'concluidos') list = list.filter(c => c.cid === lastColId && !c.archived);
      else if (status === 'atrasados') list = list.filter(c => c.due && new Date(c.due + 'T00:00:00').getTime() < now && c.cid !== lastColId && !c.archived);
      else if (status === 'arquivados') list = list.filter(c => c.archived);
      else if (status === 'snoozed') list = list.filter(c => c.snoozedUntil && c.snoozedUntil > now);
      else if (status === 'favoritos') list = list.filter(c => c.starred && !c.archived);
      if (input.prioridade) list = list.filter(c => c.prio === input.prioridade);
      if (input.cliente) {
        const q = String(input.cliente).toLowerCase();
        list = list.filter(c => c.name.toLowerCase().includes(q));
      }
      const limit = input.limit || 20;
      return { total: list.length, cards: list.slice(0, limit).map(summarizeCard) };
    }

    case 'create_card': {
      const cid = (input.coluna && findCol(input.coluna)) || boardCols[0]?.id;
      if (!cid) return { error: 'Nenhuma coluna disponível no board ativo.' };
      const newId = genId();
      addCard({
        id: newId, cid, name: String(input.nome || '').trim() || 'Sem título',
        plat: (input.plataformas as Platform[]) || [],
        prio: (input.prioridade as Priority) || 'med',
        color: CARD_COLORS[0], note: input.nota || '', desc: '',
        assignee: null, due: null, tagIds: [], subtasks: [], attachments: [], comments: [],
        ts: Date.now()
      });
      const created = useData.getState().data.cards.find(c => c.id === newId);
      return { ok: true, card: created ? summarizeCard(created) : null };
    }

    case 'update_card': {
      const card = boardCards.find(c => c.id === input.id);
      if (!card) return { error: `Card ${input.id} não encontrado` };
      const patch: any = {};
      if (input.nome) patch.name = input.nome;
      if (input.prioridade) patch.prio = input.prioridade;
      if (input.nota !== undefined) patch.note = input.nota;
      if (input.descricao !== undefined) patch.desc = input.descricao;
      if (input.responsavel !== undefined) patch.assignee = input.responsavel || null;
      if (input.vencimento !== undefined) patch.due = input.vencimento || null;
      updateCard(card.id, patch);
      return { ok: true };
    }

    case 'move_card': {
      const card = boardCards.find(c => c.id === input.id);
      if (!card) return { error: 'Card não encontrado' };
      const targetCid = findCol(input.coluna);
      if (!targetCid) return { error: `Coluna "${input.coluna}" não encontrada no board ativo` };
      const r = moveCard(card.id, targetCid);
      return { ok: r.moved, from: r.oldName, to: r.newName };
    }

    case 'archive_card':
      archiveCard(input.id, true);
      return { ok: true };

    case 'snooze_card': {
      const days = Number(input.dias) || 1;
      const t = new Date(); t.setDate(t.getDate() + days); t.setHours(9, 0, 0, 0);
      snoozeCard(input.id, t.getTime());
      return { ok: true, ate: t.toISOString().slice(0,10) };
    }

    case 'star_card':
      toggleStarCard(input.id);
      return { ok: true };

    case 'add_subtask':
      addSubtask(input.id, String(input.texto));
      return { ok: true };

    case 'add_comment':
      addComment(input.id, String(input.texto), 'Assistant');
      return { ok: true };

    case 'list_columns':
      return { columns: boardCols.map(c => ({ id: c.id, nome: c.name, cor: c.color, total_cards: boardCards.filter(x => x.cid === c.id).length })) };

    case 'list_clients': {
      const cs = allClients(d).filter(c => !c.profile?.archived);
      return { total: cs.length, clientes: cs.slice(0, 30).map(c => ({
        nome: c.displayName, total_cards: c.totalCards, ativos: c.activeCards, concluidos: c.doneCards,
        email: c.profile?.email, telefone: c.profile?.phone, valor_hora: c.profile?.hourlyRate
      })) };
    }

    case 'list_boards':
      return { boards: (d.boards || []).map(b => ({
        id: b.id, nome: b.name, emoji: b.emoji, ativo: b.id === d.activeBoardId
      })) };

    case 'switch_board':
      setActiveBoard(input.id);
      return { ok: true };

    case 'get_stats': {
      const dias = input.dias || 7;
      const agg = aggregate(d, dias);
      return {
        board_atual: d.boards?.find(b => b.id === d.activeBoardId)?.name || '—',
        total_cards: boardCards.length,
        ativos: boardCards.filter(c => !c.archived && c.cid !== lastColId).length,
        concluidos: boardCards.filter(c => c.cid === lastColId && !c.archived).length,
        atrasados: boardCards.filter(c => c.due && new Date(c.due + 'T00:00:00').getTime() < now && c.cid !== lastColId && !c.archived).length,
        favoritos: boardCards.filter(c => c.starred && !c.archived).length,
        atividade: { dias, total: agg.total, criados: agg.cardsCreated, concluidos_periodo: agg.cardsCompleted, dias_ativos: agg.activeDays },
        streak: { atual: d.streak?.current || 0, recorde: d.streak?.longest || 0 },
        semana: weekId(), hoje: todayStr()
      };
    }

    case 'open_card':
      useUI.getState().openDetail(input.id);
      return { ok: true };

    case 'switch_view':
      useUI.getState().setView(input.view);
      return { ok: true };

    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}

// ─── Claude API call ───────────────────────────────────────────────────────
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: any;  // string OR array of blocks
}

export const SYSTEM_PROMPT = `Você é o assistente IA do Walkers Kanban, um app de gestão de implementações de chatbots.
Você ajuda o Léo (dono do app, implementador de chatbots para clientes) a gerenciar seus boards, cards, clientes e reuniões.

DIRETRIZES:
- Responda SEMPRE em português brasileiro, tom amigável e direto, com poucas palavras.
- Use as tools pra agir sem pedir permissão pra ações simples (criar/mover/arquivar cards).
- Pra ações DESTRUTIVAS irreversíveis (deletar), pergunte antes.
- Quando o usuário pedir "resumo", "como tá meu dia", "o que fazer", use get_stats + list_cards e dê uma resposta concisa e útil.
- Quando criar múltiplos cards em sequência, faça em paralelo (várias tool_use no mesmo turn).
- Use markdown quando ajudar a clareza, mas evite excessos.
- Não invente dados — sempre consulte com tools antes de afirmar números.
- Após criar/mover cards, mencione brevemente o que fez (ex: "Criado o card X em Em Implementação").`;

export async function callClaude(
  apiKey: string,
  messages: ClaudeMessage[],
  onProgress?: (text: string) => void
): Promise<{ assistantMessage: ClaudeMessage; toolUses: Array<{ id: string; name: string; input: any }>; stopReason: string }> {
  const body = {
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages
  };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `Claude API ${res.status}`;
    try {
      const j = JSON.parse(errText);
      if (j.error?.message) msg += `: ${j.error.message}`;
    } catch {
      msg += `: ${errText.slice(0, 200)}`;
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const content = data.content || [];
  const toolUses: Array<{ id: string; name: string; input: any }> = [];
  let assistantText = '';
  for (const block of content) {
    if (block.type === 'text') {
      assistantText += block.text;
      onProgress?.(block.text);
    } else if (block.type === 'tool_use') {
      toolUses.push({ id: block.id, name: block.name, input: block.input });
    }
  }
  return {
    assistantMessage: { role: 'assistant', content },
    toolUses,
    stopReason: data.stop_reason || 'end_turn'
  };
}

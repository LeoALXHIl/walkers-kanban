#!/usr/bin/env node
/**
 * Walkers Kanban — MCP Server v3
 * Exposes the kanban as MCP tools for Claude Desktop.
 *
 * Reads/writes Firestore directly (per-user doc) so changes propagate to the
 * desktop app in real time even when the app is closed. Authentication uses
 * the Firebase ID/refresh token that the desktop app writes to
 *   ~/.walkers-kanban/auth.json
 * on every login/refresh.
 *
 * Falls back to a local data.json mirror if Firestore is unreachable or the
 * user hasn't signed in yet via the desktop app.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const DATA_DIR = path.join(os.homedir(), '.walkers-kanban');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

const DEFAULT_DATA = {
  version: 3,
  cols: [
    { id: 'c1', name: 'A Iniciar', color: '#3b82f6' },
    { id: 'c2', name: 'Em Implementação', color: '#a855f7' },
    { id: 'c3', name: 'Aguardando Cliente', color: '#f59e0b' },
    { id: 'c4', name: 'Concluído', color: '#22c55e' }
  ],
  cards: [],
  members: [],
  tags: []
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
}

function migrate(d) {
  if (!d.version) d.version = 3;
  if (!d.members) d.members = [];
  if (!d.tags) d.tags = [];
  if (!d.cols || !d.cols.length) d.cols = JSON.parse(JSON.stringify(DEFAULT_DATA.cols));
  if (!d.cards) d.cards = [];
  if (!d.streak) d.streak = { current: 0, longest: 0, lastActivityDay: null, startedAt: null, lastWrapShownWeek: null };
  if (!d.activity) d.activity = {};
  (d.cards || []).forEach(c => {
    if (c.desc === undefined) c.desc = '';
    if (c.subtasks === undefined) c.subtasks = [];
    if (c.due === undefined) c.due = null;
    if (c.tagIds === undefined) c.tagIds = [];
    if (c.assignee === undefined) c.assignee = null;
    if (c.attachments === undefined) c.attachments = [];
    if (c.comments === undefined) c.comments = [];
  });
  return d;
}

function logErr(...args) { process.stderr.write('[walkers-mcp] ' + args.join(' ') + '\n'); }

// ─── Auth file ────────────────────────────────────────────────────────
function loadAuth() {
  if (!fs.existsSync(AUTH_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')); }
  catch { return null; }
}

function saveAuth(payload) {
  ensureFile();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

async function refreshIdToken(authData) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${authData.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(authData.refreshToken)}`
  });
  if (!res.ok) throw new Error(`Token refresh falhou (${res.status}). Faça login de novo no app.`);
  const j = await res.json();
  const refreshed = {
    ...authData,
    idToken: j.id_token,
    refreshToken: j.refresh_token || authData.refreshToken,
    expiresAt: Date.now() + (Number(j.expires_in || 3600) * 1000)
  };
  saveAuth(refreshed);
  return refreshed;
}

async function ensureToken() {
  const a = loadAuth();
  if (!a) throw new Error('Não autenticado. Abra o app Walkers Kanban e faça login pelo menos uma vez.');
  if (a.expiresAt && a.expiresAt > Date.now() + 60_000) return a;
  return await refreshIdToken(a);
}

// ─── Firestore REST helpers ───────────────────────────────────────────
function toFs(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFs) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = toFs(v);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function fromFs(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.nullValue !== undefined) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromFs);
  if (value.mapValue) {
    const obj = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) obj[k] = fromFs(v);
    return obj;
  }
  return null;
}

function docToData(doc) {
  if (!doc || !doc.fields) return null;
  const result = {};
  for (const [k, v] of Object.entries(doc.fields)) result[k] = fromFs(v);
  return result;
}

function dataToFields(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFs(v);
  return fields;
}

async function fetchFirestoreDoc(authData) {
  const url = `https://firestore.googleapis.com/v1/projects/${authData.projectId}/databases/(default)/documents/users/${authData.uid}/kanban/main`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${authData.idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore GET ${res.status}: ${text.slice(0, 200)}`);
  }
  return docToData(await res.json());
}

async function writeFirestoreDoc(authData, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${authData.projectId}/databases/(default)/documents/users/${authData.uid}/kanban/main`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${authData.idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: dataToFields(data) })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore PATCH ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ─── Data layer (Firestore-first, local fallback) ─────────────────────
//
// Strategy: cache aggressively (1x read per 24h) to stay way under the free-tier
// Firestore quota. Writes ALWAYS go through immediately and refresh the cache,
// so Claude's view of its own edits is real-time. Edits made externally (in the
// desktop app) won't be visible to Claude until the cache TTL expires OR the
// user calls the `refresh_data` tool ("Claude, atualiza o kanban").
let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

async function loadData(force = false) {
  ensureFile();
  let authData = null;
  try { authData = await ensureToken(); } catch (e) { logErr('No auth:', e.message); }

  if (authData) {
    try {
      if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
      const remote = await fetchFirestoreDoc(authData);
      const data = migrate(remote || JSON.parse(JSON.stringify(DEFAULT_DATA)));
      cache = data;
      cacheAt = Date.now();
      // Mirror to local cache file (best-effort; helps the desktop app's fs.watch path)
      try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch {}
      return data;
    } catch (e) {
      logErr('Firestore read falhou, usando local:', e.message);
    }
  }
  // Local fallback
  try { return migrate(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))); }
  catch { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

async function saveData(data) {
  ensureFile();
  migrate(data);
  cache = data;
  cacheAt = Date.now();
  // Write local cache immediately
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch {}
  // Push to Firestore
  let authData = null;
  try { authData = await ensureToken(); } catch (e) { logErr('No auth on save:', e.message); }
  if (authData) {
    try { await writeFirestoreDoc(authData, data); }
    catch (e) { logErr('Firestore write falhou (dados no cache local):', e.message); }
  }
}

const genId = () => '_' + Math.random().toString(36).slice(2, 9);

const PRIO_LABEL = { high: 'Alta', med: 'Média', low: 'Baixa' };
const PLAT_LABEL = { wpp: 'WhatsApp', insta: 'Instagram', msg: 'Messenger' };

function findColumn(data, ref) {
  if (!ref) return null;
  return data.cols.find(c => c.id === ref) ||
         data.cols.find(c => c.name.toLowerCase() === ref.toLowerCase()) ||
         data.cols.find(c => c.name.toLowerCase().includes(ref.toLowerCase())) || null;
}

function findCard(data, ref) {
  if (!ref) return null;
  return data.cards.find(c => c.id === ref) ||
         data.cards.find(c => c.name.toLowerCase() === ref.toLowerCase()) ||
         data.cards.find(c => c.name.toLowerCase().includes(ref.toLowerCase())) || null;
}

function findTag(data, ref) {
  if (!ref) return null;
  return data.tags.find(t => t.id === ref) ||
         data.tags.find(t => t.name.toLowerCase() === ref.toLowerCase()) ||
         data.tags.find(t => t.name.toLowerCase().includes(ref.toLowerCase())) || null;
}

function summarizeCard(card, data) {
  const col = data.cols.find(c => c.id === card.cid);
  const tags = (card.tagIds || []).map(tid => {
    const t = data.tags.find(x => x.id === tid);
    return t ? t.name : null;
  }).filter(Boolean);
  const subDone = (card.subtasks || []).filter(s => s.done).length;
  const subTotal = (card.subtasks || []).length;
  return {
    id: card.id,
    nome: card.name,
    coluna: col ? col.name : '(órfão)',
    coluna_id: card.cid,
    plataformas: (card.plat || []).map(p => PLAT_LABEL[p] || p),
    prioridade: PRIO_LABEL[card.prio] || card.prio,
    descricao: card.desc || '',
    observacoes: card.note || '',
    responsavel: card.assignee || null,
    data_vencimento: card.due || null,
    etiquetas: tags,
    subtarefas: subTotal > 0 ? `${subDone}/${subTotal} concluídas` : 'nenhuma',
    subtarefas_lista: (card.subtasks || []).map(s => ({ texto: s.text, concluida: !!s.done })),
    anexos: (card.attachments || []).map(a => ({ titulo: a.title, url: a.url })),
    comentarios: (card.comments || []).length,
    criado_em: card.ts ? new Date(card.ts).toLocaleString('pt-BR') : null
  };
}

// Compact representation: ~70% fewer tokens than summarizeCard.
// Used by default in list_cards to keep Anthropic costs low.
function summarizeCardCompact(card, data) {
  const col = data.cols.find(c => c.id === card.cid);
  const subTotal = (card.subtasks || []).length;
  const subDone = (card.subtasks || []).filter(s => s.done).length;
  const compact = {
    id: card.id,
    nome: card.name,
    coluna: col ? col.name : '(órfão)',
    prio: PRIO_LABEL[card.prio] || card.prio
  };
  if (card.plat && card.plat.length) compact.plat = card.plat.map(p => PLAT_LABEL[p] || p);
  if (card.assignee) compact.responsavel = card.assignee;
  if (card.due) compact.vencimento = card.due;
  if (subTotal) compact.subtarefas = `${subDone}/${subTotal}`;
  return compact;
}

// ─── Tools ────────────────────────────────────────────────────────────
const tools = {
  list_cards: {
    description: 'Lista cards do kanban. Por padrão retorna formato compacto (id, nome, coluna, prioridade, plataformas) pra economizar tokens. Use detailed=true só se precisar dos campos completos (descrição, subtarefas, anexos, etc.). Pra detalhes de UM card específico, use get_card.',
    inputSchema: {
      type: 'object',
      properties: {
        column: { type: 'string', description: 'ID ou nome da coluna' },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        search: { type: 'string', description: 'Busca no nome, descrição ou observações' },
        assignee: { type: 'string', description: 'Nome do responsável' },
        overdue_only: { type: 'boolean', description: 'Se true, retorna só cards com vencimento no passado' },
        detailed: { type: 'boolean', description: 'Se true, retorna todos os campos (descrição, subtarefas, anexos, comentários). Default false.' },
        limit: { type: 'number', description: 'Limite de resultados (default 50)' }
      }
    },
    handler: async ({ column, priority, search, assignee, overdue_only, detailed, limit }) => {
      const data = await loadData();
      let list = data.cards;
      if (column) {
        const col = findColumn(data, column);
        if (!col) throw new Error(`Coluna "${column}" não encontrada. Disponíveis: ${data.cols.map(c => c.name).join(', ')}`);
        list = list.filter(c => c.cid === col.id);
      }
      if (priority) list = list.filter(c => c.prio === priority);
      if (assignee) list = list.filter(c => (c.assignee || '').toLowerCase().includes(assignee.toLowerCase()));
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.note || '').toLowerCase().includes(q) ||
          (c.desc || '').toLowerCase().includes(q)
        );
      }
      if (overdue_only) {
        const now = Date.now();
        list = list.filter(c => c.due && new Date(c.due).getTime() < now);
      }
      const totalMatching = list.length;
      const max = typeof limit === 'number' && limit > 0 ? limit : 50;
      const truncated = list.length > max;
      list = list.slice(0, max);
      const mapped = list.map(c => detailed ? summarizeCard(c, data) : summarizeCardCompact(c, data));
      return {
        total: totalMatching,
        retornados: mapped.length,
        truncado: truncated,
        modo: detailed ? 'detailed' : 'compact',
        cards: mapped
      };
    }
  },

  get_card: {
    description: 'Detalhes completos de um card.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string', description: 'ID ou nome do card' } },
      required: ['card']
    },
    handler: async ({ card }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      return summarizeCard(c, data);
    }
  },

  create_card: {
    description: 'Cria um card. Campos: name (obrigatório), column, platforms, priority, color, note, desc, assignee, due, tags.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        column: { type: 'string' },
        platforms: { type: 'array', items: { type: 'string', enum: ['wpp', 'insta', 'msg'] } },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        color: { type: 'string' },
        note: { type: 'string' },
        desc: { type: 'string' },
        assignee: { type: 'string' },
        due: { type: 'string', description: 'YYYY-MM-DD' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['name']
    },
    handler: async ({ name, column, platforms, priority, color, note, desc, assignee, due, tags }) => {
      const data = await loadData();
      const col = column ? findColumn(data, column) : data.cols[0];
      if (!col) throw new Error(`Coluna "${column}" não encontrada.`);
      const tagIds = [];
      if (tags && tags.length) {
        tags.forEach(tn => {
          let t = findTag(data, tn);
          if (!t) { t = { id: genId(), name: tn, color: '#7c5cfc' }; data.tags.push(t); }
          tagIds.push(t.id);
        });
      }
      const card = {
        id: genId(), cid: col.id, name,
        plat: platforms || [], prio: priority || 'med',
        color: color || '#7c5cfc', note: note || '', desc: desc || '',
        assignee: assignee || null, due: due || null,
        tagIds, subtasks: [], attachments: [], comments: [], ts: Date.now()
      };
      data.cards.push(card);
      await saveData(data);
      return { sucesso: true, card: summarizeCard(card, data) };
    }
  },

  update_card: {
    description: 'Atualiza campos de um card. Passe só os campos que quer mudar.',
    inputSchema: {
      type: 'object',
      properties: {
        card: { type: 'string' },
        name: { type: 'string' },
        column: { type: 'string' },
        platforms: { type: 'array', items: { type: 'string', enum: ['wpp', 'insta', 'msg'] } },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        color: { type: 'string' },
        note: { type: 'string' },
        desc: { type: 'string' },
        assignee: { type: 'string' },
        due: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['card']
    },
    handler: async ({ card, name, column, platforms, priority, color, note, desc, assignee, due, tags }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      if (name !== undefined) c.name = name;
      if (column !== undefined) {
        const col = findColumn(data, column);
        if (!col) throw new Error(`Coluna "${column}" não encontrada.`);
        c.cid = col.id;
      }
      if (platforms !== undefined) c.plat = platforms;
      if (priority !== undefined) c.prio = priority;
      if (color !== undefined) c.color = color;
      if (note !== undefined) c.note = note;
      if (desc !== undefined) c.desc = desc;
      if (assignee !== undefined) c.assignee = assignee === 'null' ? null : assignee;
      if (due !== undefined) c.due = (due === 'null' || due === '') ? null : due;
      if (tags !== undefined) {
        const tagIds = [];
        tags.forEach(tn => {
          let t = findTag(data, tn);
          if (!t) { t = { id: genId(), name: tn, color: '#7c5cfc' }; data.tags.push(t); }
          tagIds.push(t.id);
        });
        c.tagIds = tagIds;
      }
      await saveData(data);
      return { sucesso: true, card: summarizeCard(c, data) };
    }
  },

  move_card: {
    description: 'Move um card para outra coluna.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' }, column: { type: 'string' } },
      required: ['card', 'column']
    },
    handler: ({ card, column }) => tools.update_card.handler({ card, column })
  },

  delete_card: {
    description: 'Remove um card permanentemente. Confirme com o usuário antes.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' } },
      required: ['card']
    },
    handler: async ({ card }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      data.cards = data.cards.filter(x => x.id !== c.id);
      await saveData(data);
      return { sucesso: true, mensagem: `Card "${c.name}" removido.` };
    }
  },

  add_subtask: {
    description: 'Adiciona uma subtarefa a um card. Aceita `title` (preferido) ou `text` por compatibilidade.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' } },
      required: ['card']
    },
    handler: async ({ card, title, text }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      const t = (title || text || '').trim();
      if (!t) throw new Error('Informe `title` (texto da subtarefa).');
      if (!c.subtasks) c.subtasks = [];
      const sub = { id: genId(), text: t, done: false, status: 'todo' };
      c.subtasks.push(sub);
      await saveData(data);
      return { sucesso: true, subtask: { id: sub.id, title: sub.text, completed: false }, card: c.name };
    }
  },

  list_subtasks: {
    description: 'Lista todas as subtarefas de um card. Retorna { id, title, completed }.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' } },
      required: ['card']
    },
    handler: async ({ card }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      const subtasks = (c.subtasks || []).map(s => ({
        id: s.id,
        title: s.text,
        completed: s.status === 'done' || !!s.done
      }));
      return { sucesso: true, card: c.name, total: subtasks.length, subtasks };
    }
  },

  update_subtask: {
    description: 'Atualiza título e/ou status (completed) de uma subtarefa de um card.',
    inputSchema: {
      type: 'object',
      properties: {
        card: { type: 'string' },
        subtask_id: { type: 'string' },
        title: { type: 'string' },
        completed: { type: 'boolean' }
      },
      required: ['card', 'subtask_id']
    },
    handler: async ({ card, subtask_id, title, completed }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      const st = (c.subtasks || []).find(s => s.id === subtask_id);
      if (!st) throw new Error(`Subtarefa "${subtask_id}" não encontrada no card "${c.name}".`);
      if (title !== undefined) {
        const t = String(title).trim();
        if (!t) throw new Error('`title` não pode ser vazio.');
        st.text = t;
      }
      if (completed !== undefined) {
        st.done = !!completed;
        st.status = completed ? 'done' : 'todo';
      }
      await saveData(data);
      return {
        sucesso: true,
        subtask: { id: st.id, title: st.text, completed: st.status === 'done' || !!st.done }
      };
    }
  },

  delete_subtask: {
    description: 'Remove uma subtarefa de um card pelo id.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' }, subtask_id: { type: 'string' } },
      required: ['card', 'subtask_id']
    },
    handler: async ({ card, subtask_id }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      const before = (c.subtasks || []).length;
      c.subtasks = (c.subtasks || []).filter(s => s.id !== subtask_id);
      if (c.subtasks.length === before) {
        throw new Error(`Subtarefa "${subtask_id}" não encontrada no card "${c.name}".`);
      }
      await saveData(data);
      return { sucesso: true, removed_id: subtask_id, restantes: c.subtasks.length };
    }
  },

  toggle_subtask: {
    description: 'Marca/desmarca uma subtarefa como concluída.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' }, subtask: { type: 'string' }, done: { type: 'boolean' } },
      required: ['card', 'subtask', 'done']
    },
    handler: async ({ card, subtask, done }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      const st = (c.subtasks || []).find(s => s.text.toLowerCase().includes(subtask.toLowerCase()));
      if (!st) throw new Error(`Subtarefa "${subtask}" não encontrada no card.`);
      st.done = !!done;
      await saveData(data);
      return { sucesso: true, card: summarizeCard(c, data) };
    }
  },

  add_comment: {
    description: 'Adiciona um comentário a um card.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' }, text: { type: 'string' }, author: { type: 'string' } },
      required: ['card', 'text']
    },
    handler: async ({ card, text, author }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      if (!c.comments) c.comments = [];
      c.comments.push({ id: genId(), text, author: author || 'Claude', ts: Date.now() });
      await saveData(data);
      return { sucesso: true, total_comentarios: c.comments.length, card: c.name };
    }
  },

  list_comments: {
    description: 'Lista comentários de um card.',
    inputSchema: {
      type: 'object',
      properties: { card: { type: 'string' } },
      required: ['card']
    },
    handler: async ({ card }) => {
      const data = await loadData();
      const c = findCard(data, card);
      if (!c) throw new Error(`Card "${card}" não encontrado.`);
      return {
        card: c.name,
        total: (c.comments || []).length,
        comentarios: (c.comments || []).map(cm => ({
          autor: cm.author || 'Anônimo',
          texto: cm.text,
          quando: cm.ts ? new Date(cm.ts).toLocaleString('pt-BR') : null
        }))
      };
    }
  },

  list_columns: {
    description: 'Lista colunas com contagem de cards.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const data = await loadData();
      return {
        colunas: data.cols.map(c => ({
          id: c.id, nome: c.name, cor: c.color,
          total_cards: data.cards.filter(x => x.cid === c.id).length
        }))
      };
    }
  },

  create_column: {
    description: 'Cria uma nova coluna.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, color: { type: 'string' } },
      required: ['name']
    },
    handler: async ({ name, color }) => {
      const data = await loadData();
      const col = { id: genId(), name, color: color || '#3b82f6' };
      data.cols.push(col);
      await saveData(data);
      return { sucesso: true, coluna: col };
    }
  },

  update_column: {
    description: 'Atualiza nome/cor de uma coluna.',
    inputSchema: {
      type: 'object',
      properties: { column: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' } },
      required: ['column']
    },
    handler: async ({ column, name, color }) => {
      const data = await loadData();
      const col = findColumn(data, column);
      if (!col) throw new Error(`Coluna "${column}" não encontrada.`);
      if (name !== undefined) col.name = name;
      if (color !== undefined) col.color = color;
      await saveData(data);
      return { sucesso: true, coluna: col };
    }
  },

  delete_column: {
    description: 'Remove coluna. Cards vão pra primeira coluna restante. Confirme antes.',
    inputSchema: {
      type: 'object',
      properties: { column: { type: 'string' } },
      required: ['column']
    },
    handler: async ({ column }) => {
      const data = await loadData();
      const col = findColumn(data, column);
      if (!col) throw new Error(`Coluna "${column}" não encontrada.`);
      const fallback = data.cols.find(c => c.id !== col.id);
      let moved = 0;
      if (fallback) {
        data.cards.forEach(c => { if (c.cid === col.id) { c.cid = fallback.id; moved++; } });
      } else {
        data.cards = data.cards.filter(c => c.cid !== col.id);
      }
      data.cols = data.cols.filter(c => c.id !== col.id);
      await saveData(data);
      return { sucesso: true, mensagem: `Coluna "${col.name}" removida.`, cards_movidos: moved };
    }
  },

  refresh_data: {
    description: 'Força MCP a re-ler o kanban do Firestore agora (ignora cache de 24h). Use quando você editou cards no app desktop e quer que o Claude veja as mudanças imediatamente.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      invalidateCache();
      const data = await loadData(true);
      return {
        sucesso: true,
        mensagem: `Cache atualizado do Firestore. ${data.cards.length} card(s) · ${data.cols.length} coluna(s).`,
        cards: data.cards.length,
        colunas: data.cols.length,
        atualizado_em: new Date().toLocaleString('pt-BR')
      };
    }
  },

  get_stats: {
    description: 'Resumo geral: total de cards, distribuição por coluna/prioridade/plataforma, atrasados, % concluído, streak.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const data = await loadData();
      const total = data.cards.length;
      const byCol = {};
      data.cols.forEach(c => { byCol[c.name] = data.cards.filter(x => x.cid === c.id).length; });
      const byPrio = { Alta: 0, 'Média': 0, Baixa: 0 };
      data.cards.forEach(c => { byPrio[PRIO_LABEL[c.prio] || 'Média']++; });
      const byPlat = { WhatsApp: 0, Instagram: 0, Messenger: 0 };
      data.cards.forEach(c => (c.plat || []).forEach(p => { if (PLAT_LABEL[p]) byPlat[PLAT_LABEL[p]]++; }));
      const now = Date.now();
      const overdue = data.cards.filter(c => c.due && new Date(c.due).getTime() < now).length;
      const lastCol = data.cols[data.cols.length - 1];
      const done = lastCol ? data.cards.filter(c => c.cid === lastCol.id).length : 0;
      const streak = data.streak || {};
      return {
        total_cards: total,
        total_colunas: data.cols.length,
        por_coluna: byCol,
        por_prioridade: byPrio,
        por_plataforma: byPlat,
        cards_atrasados: overdue,
        percentual_concluido: total > 0 ? Math.round((done / total) * 100) : 0,
        streak_atual: streak.current || 0,
        melhor_streak: streak.longest || 0
      };
    }
  }
};

// ─── JSON-RPC plumbing ────────────────────────────────────────────────
function send(message) { process.stdout.write(JSON.stringify(message) + '\n'); }

async function handleRequest(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'walkers-kanban', version: '3.3.0' }
      }
    };
  }
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0', id,
      result: {
        tools: Object.entries(tools).map(([name, t]) => ({
          name, description: t.description, inputSchema: t.inputSchema
        }))
      }
    };
  }
  if (method === 'tools/call') {
    const toolName = params && params.name;
    const tool = tools[toolName];
    if (!tool) return { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool desconhecida: ${toolName}` } };
    try {
      const result = await tool.handler(params.arguments || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } };
    } catch (e) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Erro: ' + e.message }], isError: true } };
    }
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (id === undefined || id === null) return null;
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Método não implementado: ${method}` } };
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch (e) { logErr('JSON inválido:', e.message); return; }
  try {
    const resp = await handleRequest(req);
    if (resp) send(resp);
  } catch (e) {
    logErr('Erro ao processar:', e.stack || e.message);
    if (req.id !== undefined) send({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: e.message } });
  }
});

const _bootAuth = loadAuth();
if (_bootAuth && _bootAuth.uid) {
  logErr(`Walkers Kanban MCP v3.3 iniciado · usuário: ${_bootAuth.email || _bootAuth.uid} · projeto: ${_bootAuth.projectId} · cache: 24h · compact mode`);
} else {
  logErr('Walkers Kanban MCP v3.3 iniciado · SEM AUTH (faça login no app primeiro) · fallback local:', DATA_FILE);
}

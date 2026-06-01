// Exportação de dados pra Power BI / Excel — 100% client-side, sem API nem backend.
// Gera CSV (separador ';', com BOM UTF-8 pra acentos abrirem certo no Excel PT-BR).
import { useData } from '@/store/data';
import type { AppData, Card, Subtask } from '@/types';

function isoDate(ms?: number): string {
  return ms ? new Date(ms).toISOString().slice(0, 10) : '';
}
function ageDays(ms?: number): string {
  return ms ? String(Math.floor((Date.now() - ms) / 86400000)) : '';
}
function subDone(s: Subtask): number {
  return (s.status === 'done' || s.done) ? 1 : 0;
}

export function flattenCards(data: AppData): Record<string, any>[] {
  const cols = new Map(data.cols.map(c => [c.id, c]));
  const boards = new Map((data.boards || []).map(b => [b.id, b]));
  const tags = new Map(data.tags.map(t => [t.id, t.name]));
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return data.cards.map((c: Card) => {
    const subs = c.subtasks || [];
    const done = subs.reduce((n, s) => n + subDone(s), 0);
    const dueMs = c.due ? new Date(c.due + 'T00:00:00').getTime() : null;
    return {
      id: c.id,
      cliente: c.name || '',
      status: cols.get(c.cid)?.name || '',
      board: boards.get(c.boardId || '')?.name || '',
      prioridade: c.prio || '',
      responsavel: c.assignee || '',
      vencimento: c.due || '',
      criado_em: isoDate(c.ts),
      idade_dias: ageDays(c.ts),
      atrasado: dueMs != null && dueMs < t0.getTime() ? 1 : 0,
      arquivado: c.archived ? 1 : 0,
      favorito: c.starred ? 1 : 0,
      subtarefas_total: subs.length,
      subtarefas_concluidas: done,
      subtarefas_abertas: subs.length - done,
      comentarios: (c.comments || []).length,
      anexos: (c.attachments || []).length,
      tags: (c.tagIds || []).map(id => tags.get(id)).filter(Boolean).join(', '),
      plataformas: (c.plat || []).join(', ')
    };
  });
}

export function flattenSubtasks(data: AppData): Record<string, any>[] {
  const cols = new Map(data.cols.map(c => [c.id, c]));
  const out: Record<string, any>[] = [];
  for (const c of data.cards) {
    for (const s of c.subtasks || []) {
      out.push({
        card_id: c.id,
        cliente: c.name || '',
        status_card: cols.get(c.cid)?.name || '',
        subtarefa: s.text || '',
        responsavel: s.assignee || '',
        status: s.status || (s.done ? 'done' : 'todo'),
        vencimento: s.due || '',
        concluida: subDone(s)
      });
    }
  }
  return out;
}

export function flattenClients(data: AppData): Record<string, any>[] {
  const profiles = data.clientProfiles || {};
  const byClient: Record<string, { total: number; abertos: number }> = {};
  for (const c of data.cards) {
    const key = (c.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!byClient[key]) byClient[key] = { total: 0, abertos: 0 };
    byClient[key].total++;
    if (!c.archived) byClient[key].abertos++;
  }
  return Object.values(profiles).map(p => ({
    cliente: p.displayName || p.key,
    telefone: p.phone || '',
    email: p.email || '',
    valor_hora: p.hourlyRate != null ? p.hourlyRate : '',
    total_faturado: p.totalBilled != null ? p.totalBilled : '',
    arquivado: p.archived ? 1 : 0,
    cards_total: byClient[p.key]?.total || 0,
    cards_abertos: byClient[p.key]?.abertos || 0
  }));
}

function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  // Escapa se tiver separador, aspas ou quebra de linha
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(';')];
  for (const r of rows) {
    lines.push(headers.map(h => csvCell(r[h])).join(';'));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, rows: Record<string, any>[]): number {
  const csv = toCsv(rows);
  // BOM (﻿) faz o Excel PT-BR abrir UTF-8 com acentos corretos
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportCards(): number {
  return downloadCsv(`walkers-cards-${stamp()}.csv`, flattenCards(useData.getState().data));
}
export function exportSubtasks(): number {
  return downloadCsv(`walkers-subtarefas-${stamp()}.csv`, flattenSubtasks(useData.getState().data));
}
export function exportClients(): number {
  return downloadCsv(`walkers-clientes-${stamp()}.csv`, flattenClients(useData.getState().data));
}

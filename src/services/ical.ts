// Generate an iCalendar (.ics) file from cards with due dates.
// Importable in Google Calendar, Apple Calendar, Outlook, etc.

import type { AppData, Card } from '@/types';

const PRIO_LABEL = { high: 'Alta', med: 'Média', low: 'Baixa' };

function escapeIcs(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function fmtIcsDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD → ICS DATE value
  return dateStr.replace(/-/g, '');
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function generateIcs(data: AppData): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Walkers Kanban//PT-BR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Walkers Kanban',
    'X-WR-TIMEZONE:America/Sao_Paulo'
  ];

  const stamp = nowStamp();
  const lastColId = data.cols.length ? data.cols[data.cols.length - 1].id : null;

  data.cards.forEach((c: Card) => {
    if (!c.due) return;
    const col = data.cols.find(x => x.id === c.cid);
    const status = c.cid === lastColId ? '[CONCLUÍDO] ' : '';
    const subTotal = c.subtasks.length;
    const subDone = c.subtasks.filter(s => s.done).length;
    const descParts = [
      col ? `Coluna: ${col.name}` : '',
      `Prioridade: ${PRIO_LABEL[c.prio] || c.prio}`,
      c.assignee ? `Responsável: ${c.assignee}` : '',
      subTotal > 0 ? `Subtarefas: ${subDone}/${subTotal}` : '',
      c.note ? `\n${c.note}` : '',
      c.desc ? `\n${c.desc.slice(0, 300)}` : ''
    ].filter(Boolean).join('\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${c.id}@walkers.app`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${fmtIcsDate(c.due)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(c.due)}`);
    lines.push(`SUMMARY:${escapeIcs(status + c.name)}`);
    lines.push(`DESCRIPTION:${escapeIcs(descParts)}`);
    if (c.prio === 'high') lines.push('PRIORITY:1');
    else if (c.prio === 'med') lines.push('PRIORITY:5');
    else lines.push('PRIORITY:9');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(data: AppData, filename = 'walkers-kanban.ics'): void {
  const ics = generateIcs(data);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

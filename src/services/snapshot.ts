// Canvas-based snapshot generator. Pure browser, no external deps.
// Produces 1080×1080 PNGs ready to share on Instagram, LinkedIn, WhatsApp, etc.

import type { AppData } from '@/types';
import { aggregate, buildHeatmap, effectiveStreak } from './streak';
import { ACHIEVEMENTS, type AchievementDef } from './achievements';

export type SnapshotKind = 'streak' | 'weekly' | 'achievement';

export interface SnapshotPayload {
  kind: SnapshotKind;
  data: AppData;
  achievementId?: string; // when kind === 'achievement'
}

const W = 1080;
const H = 1080;
const PURPLE = '#7c5cfc';
const PINK = '#ec4899';
const DARK = '#0d0e11';
const TEXT = '#e8eaf0';
const TEXT2 = 'rgba(232,234,240,0.65)';
const TEXT3 = 'rgba(232,234,240,0.4)';

function paintBg(ctx: CanvasRenderingContext2D) {
  // Dark base
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, W, H);
  // Top radial gradient (purple)
  const g1 = ctx.createRadialGradient(W * 0.2, H * 0.0, 0, W * 0.2, H * 0.0, W * 0.9);
  g1.addColorStop(0, 'rgba(124,92,252,0.35)');
  g1.addColorStop(1, 'rgba(124,92,252,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  // Bottom radial gradient (pink)
  const g2 = ctx.createRadialGradient(W * 0.85, H * 1.0, 0, W * 0.85, H * 1.0, W * 0.9);
  g2.addColorStop(0, 'rgba(236,72,153,0.3)');
  g2.addColorStop(1, 'rgba(236,72,153,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  // Subtle vignette
  const g3 = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.75);
  g3.addColorStop(0, 'rgba(0,0,0,0)');
  g3.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, W, H);
}

function paintLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Rounded square gradient W
  const r = size * 0.22;
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, PURPLE);
  grad.addColorStop(1, PINK);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  // W letter
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(size * 0.55)}px Geist, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', x + size / 2, y + size / 2 + size * 0.03);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintFooter(ctx: CanvasRenderingContext2D) {
  paintLogo(ctx, W / 2 - 28, H - 110, 56);
  ctx.fillStyle = TEXT;
  ctx.font = '600 26px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Walkers Kanban', W / 2, H - 30);
  ctx.fillStyle = TEXT3;
  ctx.font = '500 18px Geist, sans-serif';
  ctx.fillText('walkers.app', W / 2, H - 10);
}

// ─── Streak card ─────────────────────────────────────────────────────
function paintStreak(ctx: CanvasRenderingContext2D, data: AppData) {
  const days = effectiveStreak(data.streak);
  const longest = data.streak?.longest || 0;
  const completed30 = aggregate(data, 30).cardsCompleted;

  // Eyebrow
  ctx.fillStyle = '#ec4899';
  ctx.font = '700 24px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MEU STREAK NO WALKERS', W / 2, 140);

  // Fire emoji
  ctx.font = '160px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('🔥', W / 2, 340);

  // Big number with gradient
  const numText = String(days);
  ctx.font = '900 240px Geist, sans-serif';
  const grad = ctx.createLinearGradient(W / 2 - 200, 380, W / 2 + 200, 580);
  grad.addColorStop(0, '#f59e0b');
  grad.addColorStop(1, '#ef4444');
  ctx.fillStyle = grad;
  ctx.fillText(numText, W / 2, 580);

  // "dias seguidos"
  ctx.fillStyle = TEXT;
  ctx.font = '500 38px Geist, sans-serif';
  ctx.fillText(days === 1 ? 'dia seguido' : 'dias seguidos', W / 2, 640);

  // Heatmap (12 weeks)
  const grid = buildHeatmap(data, 12);
  const cellSize = 22;
  const gap = 4;
  const gridW = grid.length * (cellSize + gap) - gap;
  const startX = (W - gridW) / 2;
  const startY = 720;
  for (let col = 0; col < grid.length; col++) {
    for (let row = 0; row < grid[col].length; row++) {
      const cell = grid[col][row];
      const x = startX + col * (cellSize + gap);
      const y = startY + row * (cellSize + gap);
      ctx.fillStyle = cellColor(cell.count);
      roundRect(ctx, x, y, cellSize, cellSize, 4);
      ctx.fill();
    }
  }

  // Stats row
  ctx.fillStyle = TEXT2;
  ctx.font = '500 26px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Melhor: ${longest} dias  ·  ${completed30} concluídos em 30d`, W / 2, 950);
}

function cellColor(count: number): string {
  if (count === 0) return 'rgba(255,255,255,0.06)';
  if (count <= 2) return 'rgba(124,92,252,0.35)';
  if (count <= 5) return 'rgba(124,92,252,0.6)';
  if (count <= 10) return 'rgba(124,92,252,0.85)';
  return '#7c5cfc';
}

// ─── Weekly Wrap ─────────────────────────────────────────────────────
function paintWeekly(ctx: CanvasRenderingContext2D, data: AppData) {
  const s = aggregate(data, 7);
  const headline =
    s.cardsCompleted >= 5 ? '🚀 Semana foda!'
    : s.cardsCompleted >= 1 ? '💪 Boa semana'
    : s.total > 0 ? '⏳ Organizando' : '🌱 Plantando';

  ctx.fillStyle = '#ec4899';
  ctx.font = '700 22px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MINHA SEMANA NO WALKERS', W / 2, 130);

  // Headline
  ctx.fillStyle = TEXT;
  ctx.font = '900 92px Geist, sans-serif';
  ctx.fillText(headline, W / 2, 280);

  // Subtitle
  ctx.fillStyle = TEXT2;
  ctx.font = '500 32px Geist, sans-serif';
  ctx.fillText(`${s.total} interações nos últimos 7 dias`, W / 2, 340);

  // 4 stat tiles
  const tiles = [
    { n: s.cardsCompleted, label: 'Concluídos', emoji: '✅', color: '#22c55e' },
    { n: s.cardsCreated, label: 'Novos cards', emoji: '✨', color: '#7c5cfc' },
    { n: s.cardsMoved, label: 'Movimentações', emoji: '🔀', color: '#38bdf8' },
    { n: s.comments, label: 'Comentários', emoji: '💬', color: '#f59e0b' }
  ];
  const tileW = 220;
  const tileH = 220;
  const gap = 24;
  const totalW = tileW * 2 + gap;
  const totalH = tileH * 2 + gap;
  const startX = (W - totalW) / 2;
  const startY = 430;
  tiles.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (tileW + gap);
    const y = startY + row * (tileH + gap);
    // Card bg
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x, y, tileW, tileH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Emoji
    ctx.font = '54px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.emoji, x + tileW / 2, y + 80);
    // Number
    ctx.fillStyle = t.color;
    ctx.font = '900 64px Geist, sans-serif';
    ctx.fillText(String(t.n), x + tileW / 2, y + 158);
    // Label
    ctx.fillStyle = TEXT2;
    ctx.font = '600 20px Geist, sans-serif';
    ctx.fillText(t.label, x + tileW / 2, y + 196);
  });

  // Active days highlight
  ctx.fillStyle = TEXT2;
  ctx.font = '500 28px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`📅  ${s.activeDays} de 7 dias ativos`, W / 2, 950);
}

// ─── Achievement card ────────────────────────────────────────────────
function paintAchievement(ctx: CanvasRenderingContext2D, def: AchievementDef) {
  ctx.fillStyle = '#ec4899';
  ctx.font = '700 22px Geist, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONQUISTA DESBLOQUEADA', W / 2, 140);

  // Giant emoji
  ctx.font = '320px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(def.emoji, W / 2, 530);

  // Name
  ctx.fillStyle = TEXT;
  ctx.font = '900 84px Geist, sans-serif';
  ctx.fillText(def.name, W / 2, 700);

  // Description
  ctx.fillStyle = TEXT2;
  ctx.font = '500 32px Geist, sans-serif';
  wrapText(ctx, def.description, W / 2, 770, W - 200, 44);

  // Footer label
  ctx.fillStyle = TEXT3;
  ctx.font = '600 20px Geist, sans-serif';
  ctx.fillText(`1 de ${ACHIEVEMENTS.length} conquistas`, W / 2, 900);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = words[i] + ' ';
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, curY);
}

// ─── Public API ──────────────────────────────────────────────────────
export async function renderSnapshot(payload: SnapshotPayload): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  paintBg(ctx);

  if (payload.kind === 'streak') {
    paintStreak(ctx, payload.data);
  } else if (payload.kind === 'weekly') {
    paintWeekly(ctx, payload.data);
  } else if (payload.kind === 'achievement') {
    const def = ACHIEVEMENTS.find(a => a.id === payload.achievementId);
    if (def) paintAchievement(ctx, def);
  }

  paintFooter(ctx);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 0.95);
  });
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const blob = await canvasToBlob(canvas);
  // ClipboardItem may not exist in all envs (Firefox older). Optional chain.
  const CI = (window as any).ClipboardItem;
  if (!CI || !navigator.clipboard?.write) {
    throw new Error('Clipboard de imagem não suportado nesta versão.');
  }
  const item = new CI({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename = 'walkers-snapshot.png'): Promise<void> {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Quilt and heatmap drawing. Quilt squares are small fabric patches, each with that day's
// thread sewn on; the heatmap is the day's board tinted where players unpicked.

import type { QuiltSquare } from '../../shared/api.ts';
import type { Pattern } from '../../shared/puzzle/pattern.ts';
import { seamBelow, seamRight } from '../../shared/puzzle/pattern.ts';

export const DIFFICULTY_THREAD = { easy: '#15803D', medium: '#D97706', hard: '#B91C1C' };
export const WOOL = '#CC1A2E';
export const COLUMNS = 7;

export type QuiltGeometry = { square: number; gap: number; dpr: number };

export const quiltGeometry = (width: number): QuiltGeometry => {
  const gap = Math.max(4, Math.round(width * 0.015));
  return { square: (width - gap * (COLUMNS - 1)) / COLUMNS, gap, dpr: Math.min(window.devicePixelRatio || 1, 3) };
};

export const quiltHeight = (count: number, geo: QuiltGeometry): number => {
  const rows = Math.max(1, Math.ceil(count / COLUMNS));
  return rows * geo.square + (rows - 1) * geo.gap;
};

/** Which square, if any, is under a point. */
export const squareAt = (x: number, y: number, count: number, geo: QuiltGeometry): number => {
  const col = Math.floor(x / (geo.square + geo.gap));
  const row = Math.floor(y / (geo.square + geo.gap));
  if (col < 0 || col >= COLUMNS || row < 0) return -1;
  const i = row * COLUMNS + col;
  return i < count ? i : -1;
};

const fabric = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tint: string): void => {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.08);
  ctx.fill();
  ctx.restore();
  // A running stitch round the edge, like a quilt block.
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 36, 44, 0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([s * 0.07, s * 0.05]);
  ctx.beginPath();
  ctx.roundRect(x + s * 0.07, y + s * 0.07, s * 0.86, s * 0.86, s * 0.05);
  ctx.stroke();
  ctx.restore();
};

const sewThread = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  size: number,
  thread: readonly number[],
  colour: string
): void => {
  const inner = s * 0.74;
  const cell = inner / size;
  const ox = x + (s - inner) / 2;
  const oy = y + (s - inner) / 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  thread.forEach((c, i) => {
    const px = ox + ((c % size) + 0.5) * cell;
    const py = oy + (Math.floor(c / size) + 0.5) * cell;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = cell * 0.42;
  ctx.translate(0.5, 1);
  ctx.stroke();
  ctx.translate(-0.5, -1);
  ctx.strokeStyle = colour;
  ctx.lineWidth = cell * 0.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = cell * 0.12;
  ctx.stroke();
  ctx.restore();
};

export type QuiltKind = 'personal' | 'community';

export const drawQuilt = (
  canvas: HTMLCanvasElement,
  width: number,
  squares: readonly QuiltSquare[],
  kind: QuiltKind,
  highlightDay: number,
  selected: number
): QuiltGeometry => {
  const geo = quiltGeometry(width);
  const height = quiltHeight(squares.length, geo);
  canvas.width = Math.round(width * geo.dpr);
  canvas.height = Math.round(height * geo.dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return geo;
  ctx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  squares.forEach((sq, i) => {
    const x = (i % COLUMNS) * (geo.square + geo.gap);
    const y = Math.floor(i / COLUMNS) * (geo.square + geo.gap);
    const s = geo.square;
    fabric(ctx, x, y, s, sq.thread ? '#FFFDF7' : '#F1EEE7');
    if (sq.thread) {
      const colour = kind === 'personal' ? WOOL : DIFFICULTY_THREAD[sq.difficulty];
      sewThread(ctx, x, y, s, sq.size, sq.thread, colour);
    }
    if (kind === 'community' && sq.solvers > 0) {
      // Solver count stitched in the corner.
      const label = String(sq.solvers);
      ctx.font = `700 ${Math.max(9, Math.round(s * 0.2))}px "Space Grotesk", system-ui, sans-serif`;
      const w = ctx.measureText(label).width + s * 0.12;
      ctx.fillStyle = 'rgba(22, 21, 26, 0.86)';
      ctx.beginPath();
      ctx.roundRect(x + s - w - s * 0.04, y + s - s * 0.28, w, s * 0.24, s * 0.06);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + s - w / 2 - s * 0.04, y + s - s * 0.16);
    }
    if (sq.day === highlightDay || i === selected) {
      ctx.strokeStyle = i === selected ? '#16151A' : '#E8940C';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x + 1.25, y + 1.25, s - 2.5, s - 2.5, s * 0.08);
      ctx.stroke();
    }
  });
  return geo;
};

/** The day's board, tinted by how many players unpicked back to each square. */
export const drawHeatmap = (
  canvas: HTMLCanvasElement,
  width: number,
  pattern: Pattern,
  solution: readonly number[],
  counts: readonly number[],
  hottest: number
): void => {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(width * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${width}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, width);
  const { size } = pattern;
  const pad = 6;
  const cell = (width - pad * 2) / size;
  const max = Math.max(1, ...counts);

  counts.forEach((n, c) => {
    if (n <= 0) return;
    const x = pad + (c % size) * cell;
    const y = pad + Math.floor(c / size) * cell;
    ctx.fillStyle = `rgba(232, 80, 20, ${0.15 + 0.6 * (n / max)})`;
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  });

  ctx.strokeStyle = 'rgba(78, 84, 96, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= size; i++) {
    ctx.moveTo(pad + i * cell, pad);
    ctx.lineTo(pad + i * cell, pad + size * cell);
    ctx.moveTo(pad, pad + i * cell);
    ctx.lineTo(pad + size * cell, pad + i * cell);
  }
  ctx.stroke();

  const seams = new Set(pattern.seams);
  ctx.strokeStyle = '#16151A';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let c = 0; c < size * size; c++) {
    const x = pad + (c % size) * cell;
    const y = pad + Math.floor(c / size) * cell;
    if (seams.has(seamRight(c))) {
      ctx.moveTo(x + cell, y + 3);
      ctx.lineTo(x + cell, y + cell - 3);
    }
    if (seams.has(seamBelow(c))) {
      ctx.moveTo(x + 3, y + cell);
      ctx.lineTo(x + cell - 3, y + cell);
    }
  }
  ctx.stroke();

  // Today's thread, faint, so the hot squares read as places on the route.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(204, 26, 46, 0.35)';
  ctx.lineWidth = cell * 0.22;
  ctx.beginPath();
  solution.forEach((c, i) => {
    const x = pad + ((c % size) + 0.5) * cell;
    const y = pad + (Math.floor(c / size) + 0.5) * cell;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  ctx.font = `700 ${Math.max(11, Math.round(cell * 0.34))}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  pattern.buttons.forEach((c, i) => {
    const x = pad + ((c % size) + 0.5) * cell;
    const y = pad + (Math.floor(c / size) + 0.5) * cell;
    ctx.fillStyle = '#1C1B20';
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(String(i + 1), x, y + 1);
  });

  if (hottest >= 0) {
    const x = pad + ((hottest % size) + 0.5) * cell;
    const y = pad + (Math.floor(hottest / size) + 0.5) * cell;
    ctx.strokeStyle = '#16151A';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.47, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

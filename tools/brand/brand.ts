// Draws the subreddit icon and banners with the game's own drawing code, so they match the
// game exactly. Run with: npm run brand (writes PNGs to assets/brand).

import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/alfa-slab-one/latin-400.css';
import { drawButton, drawTape, drawWool } from '../../src/client/game/draw.ts';
import type { Geometry } from '../../src/client/game/draw.ts';
import { drawLogo } from '../../src/client/game/logoDraw.ts';
import { paperTile } from '../../src/client/paper.ts';

type Pt = [number, number];
type Ctx = CanvasRenderingContext2D;

/** White sketchbook paper with a soft vignette. */
const paper = (ctx: Ctx, w: number, h: number): void => {
  ctx.fillStyle = '#FCFBF8';
  ctx.fillRect(0, 0, w, h);
  const pattern = ctx.createPattern(paperTile(), 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  const shade = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  shade.addColorStop(0, 'rgba(60, 50, 40, 0)');
  shade.addColorStop(1, 'rgba(60, 50, 40, 0.07)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
};

/** A pencil grid of `cols` x `rows` squares starting at (x, y). */
const grid = (ctx: Ctx, x: number, y: number, cell: number, cols: number, rows: number, alpha = 0.42): void => {
  ctx.strokeStyle = `rgba(78, 84, 96, ${alpha})`;
  ctx.lineWidth = Math.max(1.5, cell * 0.018);
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(x + c * cell, y);
    ctx.lineTo(x + c * cell, y + rows * cell);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(x, y + r * cell);
    ctx.lineTo(x + cols * cell, y + r * cell);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(30, 30, 36, ${alpha + 0.3})`;
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.arc(x + c * cell, y + r * cell, Math.max(1.6, cell * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** Red wool through grid squares (col, row), with numbered buttons at chosen points. */
const thread = (
  ctx: Ctx,
  x: number,
  y: number,
  cell: number,
  route: readonly Pt[],
  buttons: readonly number[],
  seed: number
): void => {
  const at = ([c, r]: Pt): Pt => [x + (c + 0.5) * cell, y + (r + 0.5) * cell];
  const pts = route.map(at);
  drawWool(ctx, pts, cell * 0.34, { seeds: pts.map((_, i) => seed + i * 7919) });
  const geo: Geometry = { edge: 0, pad: 0, cell, dpr: 1, size: 1 };
  buttons.forEach((i, n) => {
    const [bx, by] = pts[i] ?? [0, 0];
    drawButton(ctx, geo, bx, by, n + 1, true);
  });
  // Tape down the loose start, like the game's first stitch.
  const [sx, sy] = pts[0] ?? [0, 0];
  const [nx, ny] = pts[1] ?? [sx + 1, sy];
  const angle = Math.atan2(ny - sy, nx - sx);
  drawTape(ctx, sx - Math.cos(angle) * cell * 0.5, sy - Math.sin(angle) * cell * 0.5, angle + Math.PI / 2, cell * 0.78, cell * 0.32, seed);
};

/** The varsity logo, drawn at `height` and placed with its centre at (cx, cy). */
const logo = (ctx: Ctx, cx: number, cy: number, height: number): number => {
  const canvas = document.createElement('canvas');
  drawLogo(canvas, height, 1);
  ctx.drawImage(canvas, cx - canvas.width / 2, cy - canvas.height / 2);
  return canvas.width;
};

const label = (ctx: Ctx, text: string, cx: number, cy: number, size: number, colour = '#16151A'): void => {
  ctx.font = `700 ${size}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
};

/** A snake that fills a cols x rows block row by row. */
const snake = (cols: number, rows: number, c0 = 0, r0 = 0): Pt[] => {
  const out: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) out.push([c0 + (r % 2 ? cols - 1 - k : k), r0 + r]);
  }
  return out;
};

const canvasOf = (w: number, h: number): [HTMLCanvasElement, Ctx] => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  return [canvas, ctx];
};

/** 512 x 512. Reddit shows it as a circle, so everything sits inside the inscribed circle. */
const icon = (): HTMLCanvasElement => {
  const [canvas, ctx] = canvasOf(512, 512);
  paper(ctx, 512, 512);
  const cell = 108;
  const x = (512 - cell * 3) / 2;
  const y = (512 - cell * 3) / 2;
  grid(ctx, x, y, cell, 3, 3, 0.5);
  thread(ctx, x, y, cell, snake(3, 3), [0, 8], 31);
  return canvas;
};

/** 1920 x 384 desktop banner. Content stays in the middle 1300 px, clear of the corners. */
const desktop = (): HTMLCanvasElement => {
  const w = 1920;
  const h = 384;
  const [canvas, ctx] = canvasOf(w, h);
  paper(ctx, w, h);
  const cell = 64;
  // Faint grid across the whole strip, so any crop still reads as the board. The board
  // sits on the same lines.
  grid(ctx, 0, 0, cell, w / cell, h / cell, 0.16);
  const gx = cell * 18;
  const gy = cell;
  grid(ctx, gx, gy, cell, 6, 4, 0.45);
  thread(ctx, gx, gy, cell, snake(6, 4), [0, 5, 6, 13, 18, 23], 77);
  logo(ctx, 660, h / 2 - 34, 190);
  label(ctx, 'One thread. Every square. A new pattern every day.', 660, h / 2 + 104, 32);
  return canvas;
};

/** 1600 x 480 mobile banner. Everything centred, since phones crop the sides. */
const mobile = (): HTMLCanvasElement => {
  const w = 1600;
  const h = 480;
  const [canvas, ctx] = canvasOf(w, h);
  paper(ctx, w, h);
  const cell = 70;
  const x0 = (w % cell) / 2;
  const y0 = (h % cell) / 2;
  grid(ctx, x0, y0, cell, Math.floor(w / cell), Math.floor(h / cell), 0.14);
  logo(ctx, w / 2, 130, 200);
  const cols = 10;
  const gx = x0 + cell * 6;
  const gy = y0 + cell * 3;
  grid(ctx, gx, gy, cell, cols, 2, 0.45);
  thread(ctx, gx, gy, cell, snake(cols, 2), [0, 9, 19], 53);
  label(ctx, 'One thread. Every square. Daily.', w / 2, 450, 30);
  return canvas;
};

/** File name, drawing, and format. Banners are JPEG to stay under Reddit's upload limits. */
const ASSETS: Record<string, [() => HTMLCanvasElement, string]> = {
  'darnit-icon-512.png': [icon, 'image/png'],
  'darnit-banner-desktop-1920x384.jpg': [desktop, 'image/jpeg'],
  'darnit-banner-mobile-1600x480.jpg': [mobile, 'image/jpeg'],
};

declare global {
  interface Window {
    renderBrand: (name: string) => Promise<string>;
    brandNames: string[];
  }
}

window.brandNames = Object.keys(ASSETS);
window.renderBrand = async (name: string) => {
  await document.fonts.load('400 120px "Alfa Slab One"', 'DARNIT!');
  await document.fonts.load('700 30px "Space Grotesk"');
  const asset = ASSETS[name];
  if (!asset) throw new Error(`unknown asset ${name}`);
  const [make, type] = asset;
  return make().toDataURL(type, 0.9);
};

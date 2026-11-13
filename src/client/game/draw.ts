// Canvas drawing for the board, in the sketchbook look: white paper with a pencil grid and
// pricked holes, red wool laid along the thread and held down with clear tape, plain black
// numbered buttons, and black running-stitch seams. Everything is drawn in code.
//
// Drawing is split into layers so a stitch costs little: the paper never changes, the wool
// is cached and only its newest stretch is redrawn, and the buttons layer is redrawn only
// when a button is reached or a cross-stitch square changes.

import { RIGHT, LEFT, directionBetween, seamBelow, seamRight } from '../../shared/puzzle/pattern.ts';
import type { Board, Pattern } from '../../shared/puzzle/pattern.ts';
import { seeded } from '../../shared/puzzle/rng.ts';

type Pt = [number, number];
type Ctx = CanvasRenderingContext2D;

export type Geometry = {
  /** Canvas edge in CSS pixels. */
  edge: number;
  /** Margin between the canvas edge and the grid. */
  pad: number;
  cell: number;
  dpr: number;
  size: number;
};

export const layout = (edge: number, size: number): Geometry => {
  const pad = Math.max(12, Math.round(edge * 0.045));
  return { edge, pad, cell: (edge - 2 * pad) / size, dpr: Math.min(window.devicePixelRatio || 1, 3), size };
};

export const centre = (geo: Geometry, cell: number): Pt => [
  geo.pad + ((cell % geo.size) + 0.5) * geo.cell,
  geo.pad + (Math.floor(cell / geo.size) + 0.5) * geo.cell,
];

/**
 * The cell under a point, or -1 off the grid. The finger has to move a fifth of a cell past
 * the edge of the cell it is on before it counts as a new cell, so a finger resting on a
 * boundary does not flicker between two cells.
 */
export const cellAt = (geo: Geometry, x: number, y: number, current = -1): number => {
  const fx = (x - geo.pad) / geo.cell;
  const fy = (y - geo.pad) / geo.cell;
  if (current >= 0) {
    const col = current % geo.size;
    const row = Math.floor(current / geo.size);
    const m = 0.2;
    if (fx > col - m && fx < col + 1 + m && fy > row - m && fy < row + 1 + m) return current;
  }
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  if (col < 0 || row < 0 || col >= geo.size || row >= geo.size) return -1;
  return row * geo.size + col;
};

/** Wool thickness in CSS pixels. */
export const woolWidth = (geo: Geometry): number => Math.max(7, geo.cell * 0.34);

const newCanvas = (geo: Geometry): [HTMLCanvasElement, Ctx | null] => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geo.edge * geo.dpr);
  canvas.height = Math.round(geo.edge * geo.dpr);
  const ctx = canvas.getContext('2d');
  ctx?.scale(geo.dpr, geo.dpr);
  return [canvas, ctx];
};

const tracePts = (ctx: Ctx, pts: readonly Pt[], dx = 0, dy = 0): void => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x + dx, y + dy);
    else ctx.lineTo(x + dx, y + dy);
  });
  if (pts.length === 1) {
    const [x, y] = pts[0] ?? [0, 0];
    ctx.lineTo(x + dx + 0.01, y + dy);
  }
};

// ------------------------------------------------------------------ paper

/** A pencil line: slightly wobbly, drawn as many short segments. */
const pencilLine = (ctx: Ctx, a: Pt, b: Pt, rnd: () => number, wobble: number): void => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(2, Math.round(len / 12));
  ctx.moveTo(a[0] + (rnd() - 0.5) * wobble, a[1] + (rnd() - 0.5) * wobble);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * wobble, a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * wobble);
  }
};

/** A hole pricked through paper with a needle: dark centre, raised rim catching the light. */
const prickedHole = (ctx: Ctx, x: number, y: number, r: number): void => {
  ctx.fillStyle = 'rgba(30, 30, 36, 0.78)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.beginPath();
  ctx.arc(x, y, r + 1.2, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(x, y, r + 1.2, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
};

/** One length of black thread in a running-stitch seam. */
const seamStitch = (ctx: Ctx, a: Pt, b: Pt, width: number): void => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = width + 1;
  ctx.beginPath();
  ctx.moveTo(a[0] + 0.7, a[1] + 1.6);
  ctx.lineTo(b[0] + 0.7, b[1] + 1.6);
  ctx.stroke();
  ctx.strokeStyle = '#16151A';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = Math.max(0.8, width * 0.22);
  ctx.beginPath();
  ctx.moveTo(a[0] - nx * width * 0.2 - Math.abs(ny) * 0.4, a[1] - Math.abs(nx) * width * 0.2);
  ctx.lineTo(b[0] - nx * width * 0.2 - Math.abs(ny) * 0.4, b[1] - Math.abs(nx) * width * 0.2);
  ctx.stroke();
};

const drawSeam = (ctx: Ctx, a: Pt, b: Pt, cell: number): void => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const dash = cell * 0.2;
  const gap = cell * 0.1;
  const count = Math.max(1, Math.floor((len + gap) / (dash + gap)));
  let s = (len - (count * (dash + gap) - gap)) / 2;
  const width = Math.max(3.5, cell * 0.085);
  for (let i = 0; i < count; i++) {
    const p: Pt = [a[0] + ux * s, a[1] + uy * s];
    const q: Pt = [a[0] + ux * (s + dash), a[1] + uy * (s + dash)];
    seamStitch(ctx, p, q, width);
    s += dash + gap;
  }
};

/** Pencil X plus a dashed pencil ring: where the thread must cross itself. */
const crossMark = (ctx: Ctx, x: number, y: number, cell: number): void => {
  const r = cell * 0.27;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(50, 54, 62, 0.62)';
  ctx.lineWidth = Math.max(2, cell * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.setLineDash([cell * 0.07, cell * 0.06]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, cell * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
};

/** Everything that never changes during play: grid, holes, seams, cross-stitch marks. */
export const drawBackdrop = (geo: Geometry, pattern: Pattern): HTMLCanvasElement => {
  const [canvas, ctx] = newCanvas(geo);
  if (!ctx) return canvas;
  const { pad, cell, size } = geo;
  const rnd = seeded(size * 31 + pattern.buttons.length);
  const far = pad + size * cell;

  // Pencil grid, two passes for a graphite texture.
  for (const [style, width] of [
    ['rgba(78, 84, 96, 0.42)', 1],
    ['rgba(78, 84, 96, 0.14)', 2],
  ] as const) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 1; i < size; i++) {
      const at = pad + i * cell;
      pencilLine(ctx, [at, pad], [at, far], rnd, 0.8);
      pencilLine(ctx, [pad, at], [far, at], rnd, 0.8);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40, 44, 52, 0.7)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  pencilLine(ctx, [pad, pad], [far, pad], rnd, 0.9);
  pencilLine(ctx, [far, pad], [far, far], rnd, 0.9);
  pencilLine(ctx, [far, far], [pad, far], rnd, 0.9);
  pencilLine(ctx, [pad, far], [pad, pad], rnd, 0.9);
  ctx.stroke();

  // Pricked holes at every grid corner.
  const hole = Math.max(1.4, cell * 0.035);
  for (let r = 0; r <= size; r++) {
    for (let c = 0; c <= size; c++) prickedHole(ctx, pad + c * cell, pad + r * cell, hole);
  }

  for (const c of pattern.crosses) {
    const [x, y] = centre(geo, c);
    crossMark(ctx, x, y, cell);
  }

  const seams = new Set(pattern.seams);
  const trim = cell * 0.07;
  for (let i = 0; i < size * size; i++) {
    const x0 = pad + (i % size) * cell;
    const y0 = pad + Math.floor(i / size) * cell;
    if (seams.has(seamRight(i))) drawSeam(ctx, [x0 + cell, y0 + trim], [x0 + cell, y0 + cell - trim], cell);
    if (seams.has(seamBelow(i))) drawSeam(ctx, [x0 + trim, y0 + cell], [x0 + cell - trim, y0 + cell], cell);
  }
  return canvas;
};

// ------------------------------------------------------------------- wool

const WOOL = {
  shadow: 'rgba(110, 10, 20, 0.15)',
  edge: '#A3101F',
  mid: '#C4172A',
  body: '#D82437',
  sheen: '#F25A66',
  twistDark: 'rgba(110, 6, 18, 0.32)',
  twistLight: 'rgba(255, 160, 160, 0.3)',
  fibreDark: 'rgba(120, 8, 22, 0.32)',
  fibreLight: 'rgba(255, 175, 175, 0.3)',
};
const FUZZ = ['rgba(214, 34, 54, 0.55)', 'rgba(170, 14, 32, 0.45)', 'rgba(245, 110, 120, 0.4)', 'rgba(130, 8, 24, 0.38)'];

type WoolOptions = {
  /** Raise the wool off the page (0 to 1), for the length following the finger. */
  lift?: number;
  /** Loose fibres and fine texture. Off for the length following the finger, to keep it fast. */
  fuzz?: boolean;
  /** Seed for the first segment's fibres. Segment k uses seeds[k], so a segment always looks the same. */
  seeds?: readonly number[];
};

/**
 * A length of red wool through the given points: shadow, rounded body, twisted plies and
 * loose fibres. Each segment's fibres come from its own seed, so redrawing a segment later
 * gives exactly the same picture.
 */
export const drawWool = (ctx: Ctx, pts: readonly Pt[], w: number, options: WoolOptions = {}): void => {
  if (pts.length === 0) return;
  const lift = options.lift ?? 0;
  const fuzz = options.fuzz ?? true;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sx = w * 0.08 + lift * 3;
  const sy = w * 0.2 + lift * 7;
  ctx.strokeStyle = WOOL.shadow;
  ctx.lineWidth = w * 1.15;
  tracePts(ctx, pts, sx, sy);
  ctx.stroke();
  ctx.lineWidth = w * 0.9;
  tracePts(ctx, pts, sx * 0.55, sy * 0.55);
  ctx.stroke();

  for (const [colour, width, dx, dy, alpha] of [
    [WOOL.edge, 1, 0, 0, 1],
    [WOOL.mid, 0.84, 0, 0, 1],
    [WOOL.body, 0.6, -0.03, -0.05, 1],
    [WOOL.sheen, 0.26, -0.08, -0.11, 0.45],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = w * width;
    tracePts(ctx, pts, w * dx, w * dy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const dark = new Path2D();
  const light = new Path2D();
  const fibresDark = new Path2D();
  const fibresLight = new Path2D();
  const strands = FUZZ.map(() => new Path2D());
  const over = new Path2D();
  const step = w * 0.55;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1] ?? [0, 0];
    const [bx, by] = pts[k] ?? [0, 0];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const rnd = seeded(options.seeds?.[k] ?? k * 7919 + 13);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const nx = -uy;
    const ny = ux;
    const h = w * 0.4;
    const lean = w * 0.3;
    // Twisted plies: soft slanted grooves with a highlight beside each.
    for (let s = step * 0.5; s < len; s += step * (0.85 + rnd() * 0.3)) {
      const mx = ax + ux * s;
      const my = ay + uy * s;
      const bow = w * 0.12;
      dark.moveTo(mx - nx * h - ux * lean, my - ny * h - uy * lean);
      dark.quadraticCurveTo(mx + ux * bow, my + uy * bow, mx + nx * h + ux * lean, my + ny * h + uy * lean);
      const lx = mx + ux * step * 0.4;
      const ly = my + uy * step * 0.4;
      light.moveTo(lx - nx * h * 0.55 - ux * lean * 0.55, ly - ny * h * 0.55 - uy * lean * 0.55);
      light.lineTo(lx + nx * h * 0.35 + ux * lean * 0.35, ly + ny * h * 0.35 + uy * lean * 0.35);
    }
    if (!fuzz) continue;
    // Fine fibres along the strand.
    const fibres = Math.ceil(len / (w * 0.14));
    for (let i = 0; i < fibres; i++) {
      const t = rnd() * len;
      const across = (rnd() - 0.5) * w * 0.82;
      const flen = w * (0.25 + rnd() * 0.5);
      const tilt = (rnd() - 0.5) * 0.5;
      const px = ax + ux * t + nx * across;
      const py = ay + uy * t + ny * across;
      const path = rnd() < 0.5 ? fibresDark : fibresLight;
      path.moveTo(px, py);
      path.lineTo(px + (ux + nx * tilt) * flen, py + (uy + ny * tilt) * flen);
    }
    // Loose fuzz off the edges.
    const count = Math.ceil(len / (w * 0.12));
    for (let i = 0; i < count; i++) {
      const t = rnd() * len;
      const side = rnd() < 0.5 ? -1 : 1;
      const fx = nx * side;
      const fy = ny * side;
      const off = w * (0.3 + rnd() * 0.2);
      const bxp = ax + ux * t + fx * off;
      const byp = ay + uy * t + fy * off;
      const turn = (rnd() - 0.5) * 1.8;
      const dx = fx * Math.cos(turn) - fy * Math.sin(turn);
      const dy = fx * Math.sin(turn) + fy * Math.cos(turn);
      const length = w * (0.06 + rnd() * rnd() * 0.75);
      const bend = (rnd() - 0.5) * length * 0.8;
      const path = strands[Math.floor(rnd() * strands.length)] ?? over;
      path.moveTo(bxp, byp);
      path.quadraticCurveTo(bxp + dx * length * 0.5 + ux * bend, byp + dy * length * 0.5 + uy * bend, bxp + dx * length, byp + dy * length);
    }
    for (let i = 0; i < count * 0.4; i++) {
      const t = rnd() * len;
      const across = (rnd() - 0.5) * w * 0.8;
      const px = ax + ux * t - uy * across;
      const py = ay + uy * t + ux * across;
      const a = rnd() * Math.PI * 2;
      const length = w * (0.1 + rnd() * 0.22);
      over.moveTo(px, py);
      over.lineTo(px + Math.cos(a) * length, py + Math.sin(a) * length);
    }
  }
  if (fuzz) {
    ctx.lineWidth = Math.max(0.5, w * 0.04);
    ctx.strokeStyle = WOOL.fibreDark;
    ctx.stroke(fibresDark);
    ctx.strokeStyle = WOOL.fibreLight;
    ctx.stroke(fibresLight);
  }
  ctx.strokeStyle = WOOL.twistDark;
  ctx.lineWidth = Math.max(0.8, w * 0.11);
  ctx.stroke(dark);
  ctx.strokeStyle = WOOL.twistLight;
  ctx.lineWidth = Math.max(0.7, w * 0.08);
  ctx.stroke(light);
  if (fuzz) {
    ctx.lineWidth = Math.max(0.45, w * 0.03);
    strands.forEach((path, i) => {
      ctx.strokeStyle = FUZZ[i] ?? WOOL.body;
      ctx.stroke(path);
    });
    ctx.strokeStyle = 'rgba(255, 130, 130, 0.35)';
    ctx.stroke(over);
  }
  ctx.restore();
};

/** Splayed fibres at a cut end of wool. */
const frayedEnd = (ctx: Ctx, x: number, y: number, ux: number, uy: number, w: number, seed: number): void => {
  const rnd = seeded(seed);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const spread = (rnd() - 0.5) * 1.4;
    const dx = ux * Math.cos(spread) - uy * Math.sin(spread);
    const dy = ux * Math.sin(spread) + uy * Math.cos(spread);
    const sx = x - uy * (rnd() - 0.5) * w * 0.6;
    const sy = y + ux * (rnd() - 0.5) * w * 0.6;
    const len = w * (0.3 + rnd() * 0.6);
    ctx.strokeStyle = FUZZ[i % FUZZ.length] ?? WOOL.body;
    ctx.lineWidth = Math.max(0.6, w * (0.05 + rnd() * 0.06));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + dx * len * 0.5 + (rnd() - 0.5) * w * 0.3, sy + dy * len * 0.5, sx + dx * len, sy + dy * len);
    ctx.stroke();
  }
  ctx.restore();
};

/** A strip of clear tape with torn ends. It lightens whatever it covers. */
export const drawTape = (ctx: Ctx, x: number, y: number, angle: number, len: number, wid: number, seed: number): void => {
  const rnd = seeded(seed);
  const hl = len / 2;
  const hw = wid / 2;
  const tear = wid * 0.07;
  const teeth = 6;
  const path = new Path2D();
  path.moveTo(-hl, -hw);
  path.lineTo(hl, -hw);
  for (let i = 1; i <= teeth; i++) path.lineTo(hl + (i % 2 ? tear : -tear) * (0.4 + rnd()), -hw + (i / teeth) * wid);
  path.lineTo(-hl, hw);
  for (let i = 1; i <= teeth; i++) path.lineTo(-hl + (i % 2 ? -tear : tear) * (0.4 + rnd()), hw - (i / teeth) * wid);
  path.closePath();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
  ctx.translate(0.8, 1.6);
  ctx.fill(path);
  ctx.translate(-0.8, -1.6);
  ctx.fillStyle = 'rgba(250, 249, 238, 0.5)';
  ctx.fill(path);
  const gloss = ctx.createLinearGradient(-hl, -hw, hl * 0.4, hw);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gloss.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
  gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0.22)');
  ctx.fillStyle = gloss;
  ctx.fill(path);
  ctx.strokeStyle = 'rgba(90, 90, 80, 0.35)';
  ctx.lineWidth = 0.9;
  ctx.stroke(path);
  ctx.restore();
};

// ------------------------------------------------------------ thread layers

/** A segment's fibre seed depends only on where it is, so it redraws identically. */
const segmentSeed = (thread: readonly number[], k: number): number =>
  ((k * 7919) ^ ((thread[k] ?? 0) * 131) ^ ((thread[k - 1] ?? 0) * 17)) >>> 0;

/**
 * Draw the thread between point indices `from` and `to`. The thread is split where it comes
 * back to a cross-stitch square, so the second pass is drawn over the first.
 */
export const drawThreadRange = (
  ctx: Ctx,
  geo: Geometry,
  board: Board,
  thread: readonly number[],
  from: number,
  to: number
): void => {
  if (to <= from) return;
  const w = woolWidth(geo);
  let start = from;
  const flush = (end: number) => {
    if (end <= start) return;
    const pts: Pt[] = [];
    const seeds: number[] = [];
    for (let i = start; i <= end; i++) {
      pts.push(centre(geo, thread[i] ?? 0));
      seeds.push(segmentSeed(thread, i));
    }
    drawWool(ctx, pts, w, { seeds });
  };
  for (let i = from + 1; i <= to; i++) {
    const c = thread[i] ?? 0;
    if (board.isCross[c] && thread.indexOf(c) < i) {
      flush(i - 1);
      start = i - 1;
    }
  }
  flush(to);
};

export const newLayer = (geo: Geometry): [HTMLCanvasElement, Ctx | null] => newCanvas(geo);

/** A plain black button with a white number. */
export const drawButton = (ctx: Ctx, geo: Geometry, x: number, y: number, n: number, reached: boolean): void => {
  const r = geo.cell * 0.34;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.arc(x + r * 0.05, y + r * 0.14, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1C1B20';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (reached) {
    ctx.strokeStyle = '#CC1A2E';
    ctx.lineWidth = Math.max(2.5, r * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, r + ctx.lineWidth * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  const fontPx = Math.max(16, Math.round(geo.cell * 0.38));
  ctx.font = `700 ${fontPx}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(n), x, y + 1);
};

/** Inward-pointing ink chevrons on two sides of a cell, showing the pass still owed. */
const owedPass = (ctx: Ctx, x: number, y: number, cell: number, horizontal: boolean): void => {
  const d = cell * 0.43;
  const s = cell * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#16151A';
  ctx.lineWidth = Math.max(2, cell * 0.055);
  ctx.setLineDash([cell * 0.06, cell * 0.045]);
  ctx.beginPath();
  ctx.arc(x, y, cell * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(2.4, cell * 0.065);
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const tipX = horizontal ? x + side * (d - s * 1.6) : x;
    const tipY = horizontal ? y : y + side * (d - s * 1.6);
    if (horizontal) {
      ctx.moveTo(tipX + side * s, tipY - s);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX + side * s, tipY + s);
    } else {
      ctx.moveTo(tipX - s, tipY + side * s);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX + s, tipY + side * s);
    }
  }
  ctx.stroke();
  ctx.restore();
};

/** State that decides the top layer, so it is redrawn only when one of these changes. */
export const topLayerKey = (board: Board, thread: readonly number[], solved: boolean): string => {
  let reached = 0;
  for (const c of thread) if ((board.buttonIndex[c] ?? -1) >= 0) reached += 1;
  const crosses: string[] = [];
  for (let c = 0; c < board.count; c++) {
    if (!board.isCross[c]) continue;
    const first = thread.indexOf(c);
    const second = first < 0 ? -1 : thread.indexOf(c, first + 1);
    crosses.push(first < 0 ? '0' : second < 0 ? `1${thread[first - 1] ?? thread[first + 1] ?? ''}` : '2');
  }
  return `${reached}|${crosses.join(',')}|${solved}|${thread[1] ?? ''}|${solved ? thread.length : ''}`;
};

/** Above the wool: the taped tail at button 1, owed-pass marks, buttons, and the end tape. */
export const drawTopLayer = (geo: Geometry, board: Board, thread: readonly number[], solved: boolean): HTMLCanvasElement => {
  const [canvas, ctx] = newCanvas(geo);
  if (!ctx) return canvas;
  const { cell } = geo;
  const w = woolWidth(geo);
  const first = thread[0] ?? board.buttons[0] ?? 0;
  const [sx, sy] = centre(geo, first);

  // The loose tail at button 1, cut, frayed and taped to the page.
  const second = thread[1];
  let cx = -1;
  let cy = -1;
  if (second !== undefined) {
    const [nx, ny] = centre(geo, second);
    cx = -Math.sign(nx - sx) || -1;
    cy = -Math.sign(ny - sy) || -1;
  }
  const tailEnd: Pt = [sx + cx * cell * 0.42, sy + cy * cell * 0.42];
  drawWool(ctx, [[sx, sy], tailEnd], w, { seeds: [0, first * 7 + 3] });
  frayedEnd(ctx, tailEnd[0], tailEnd[1], cx / Math.SQRT2, cy / Math.SQRT2, w, first);

  // Cross-stitch squares with one pass done: show the pass still owed.
  for (let c = 0; c < board.count; c++) {
    if (!board.isCross[c]) continue;
    const at = thread.indexOf(c);
    if (at < 0 || thread.indexOf(c, at + 1) >= 0) continue;
    const neighbour = thread[at - 1] ?? thread[at + 1];
    const dir = neighbour === undefined ? -1 : directionBetween(board, neighbour, c);
    const [x, y] = centre(geo, c);
    owedPass(ctx, x, y, cell, !(dir === RIGHT || dir === LEFT));
  }

  const reached = new Set(thread);
  board.buttons.forEach((c, n) => {
    const [x, y] = centre(geo, c);
    drawButton(ctx, geo, x, y, n + 1, reached.has(c));
  });

  drawTape(ctx, sx + cx * cell * 0.4, sy + cy * cell * 0.4, Math.atan2(cy, cx) + Math.PI / 2 + 0.12, cell * 0.78, cell * 0.32, first + 101);
  if (solved && thread.length >= 2) {
    const [ax, ay] = centre(geo, thread[thread.length - 2] ?? 0);
    const [bx, by] = centre(geo, thread[thread.length - 1] ?? 0);
    drawTape(ctx, (ax + bx) / 2, (ay + by) / 2, Math.atan2(by - ay, bx - ax) + Math.PI / 2 - 0.1, cell * 0.66, cell * 0.28, thread.length + 7);
  }
  return canvas;
};

// ----------------------------------------------------------- live layer

export type Live = {
  /** True while a finger is drawing. */
  dragging: boolean;
  /** Finger position in CSS pixels on the canvas. */
  fx: number;
  fy: number;
  hintCell: number;
  hintUntil: number;
  /** Cell stitched last, and when, for the pull-through pop. */
  popCell: number;
  popAt: number;
  solved: boolean;
  reducedMotion: boolean;
  /** Squares the thread still owes, hatched when the last button was reached too early. */
  empty: readonly number[];
  /** Practice board only: the next squares to take, in order, or the one square to unpick back to. */
  guide: readonly number[];
  guideBack: boolean;
  /** When the pattern was solved in this session, for the solve moment. 0 if not. */
  solvedAt: number;
  buttons: readonly number[];
};

/** Length of the solve moment drawn on the canvas, in ms. The board's shrink is CSS. */
export const SOLVE_GLOW_MS = 1000;

/** The part of a polyline between distances a and b along it. */
const slice = (pts: readonly Pt[], a: number, b: number): Pt[] => {
  const out: Pt[] = [];
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1] ?? [0, 0];
    const q = pts[i] ?? [0, 0];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const s0 = Math.max(a, walked);
    const s1 = Math.min(b, walked + len);
    if (s1 > s0 && len > 0) {
      const at = (s: number): Pt => [p[0] + ((q[0] - p[0]) * (s - walked)) / len, p[1] + ((q[1] - p[1]) * (s - walked)) / len];
      if (out.length === 0) out.push(at(s0));
      out.push(at(s1));
    }
    walked += len;
  }
  return out;
};

/** A four-point glint, like light catching a button. */
const glint = (ctx: Ctx, x: number, y: number, r: number, alpha: number): void => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = r * 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
};

/**
 * The solve moment on the canvas: a band of light runs along the thread as it tightens,
 * then each button glints in turn.
 */
const drawSolveGlow = (ctx: Ctx, geo: Geometry, thread: readonly number[], live: Live, now: number): boolean => {
  const t = now - live.solvedAt;
  if (live.solvedAt <= 0 || t > SOLVE_GLOW_MS || live.reducedMotion) return false;
  const pts = thread.map((c) => centre(geo, c));
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1] ?? [0, 0];
    const q = pts[i] ?? [0, 0];
    total += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  const w = woolWidth(geo);
  const run = Math.min(1, t / 600);
  const head = run * (total + w * 6);
  const band = slice(pts, head - w * 6, head);
  if (band.length > 1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = w * 0.45;
    tracePts(ctx, band);
    ctx.stroke();
    ctx.restore();
  }
  live.buttons.forEach((c, i) => {
    const start = 300 + i * 45;
    const local = (t - start) / 320;
    if (local <= 0 || local >= 1) return;
    const [x, y] = centre(geo, c);
    const r = geo.cell * 0.34;
    glint(ctx, x - r * 0.45, y - r * 0.45, r * 0.7 * Math.sin(local * Math.PI), Math.sin(local * Math.PI));
  });
  return true;
};

/** Inside a square: a soft wash and an arrow pointing the way the thread goes. */
const guideSquare = (ctx: Ctx, geo: Geometry, cell: number, from: number, strength: number, back: boolean): void => {
  const { cell: size } = geo;
  const x0 = geo.pad + (cell % geo.size) * size;
  const y0 = geo.pad + Math.floor(cell / geo.size) * size;
  const inset = size * 0.08;
  ctx.fillStyle = back ? `rgba(22, 21, 26, ${0.12 * strength})` : `rgba(245, 158, 11, ${0.5 * strength})`;
  ctx.beginPath();
  ctx.roundRect(x0 + inset, y0 + inset, size - inset * 2, size - inset * 2, size * 0.14);
  ctx.fill();
  if (back) {
    // The square to go back to: a strong dashed outline so it reads over the wool.
    ctx.save();
    ctx.strokeStyle = '#16151A';
    ctx.lineWidth = Math.max(2.5, size * 0.06);
    ctx.setLineDash([size * 0.1, size * 0.07]);
    ctx.stroke();
    ctx.restore();
  }
  if (from < 0) return;
  const [ax, ay] = centre(geo, from);
  const [bx, by] = centre(geo, cell);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const tipX = bx + ux * size * 0.12;
  const tipY = by + uy * size * 0.12;
  const s = size * 0.17;
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.35 + strength);
  ctx.strokeStyle = '#16151A';
  ctx.lineWidth = Math.max(2.5, size * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(tipX - ux * s - uy * s, tipY - uy * s + ux * s);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - ux * s + uy * s, tipY - uy * s - ux * s);
  ctx.moveTo(tipX - ux * s * 2.1, tipY - uy * s * 2.1);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.restore();
};

/** Draw one frame. Returns true while something is still animating. */
export const drawFrame = (
  ctx: Ctx,
  geo: Geometry,
  thread: readonly number[],
  /** Paper and wool, drawn first. */
  layers: readonly HTMLCanvasElement[],
  /** Buttons and marks, drawn over the practice guide so numbers stay readable. */
  top: HTMLCanvasElement,
  live: Live,
  now: number
): boolean => {
  const { cell, dpr } = geo;
  let animating = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const layer of layers) ctx.drawImage(layer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const head = thread[thread.length - 1] ?? 0;
  const [hx, hy] = centre(geo, head);

  if (live.guide.length > 0) {
    const pulse = live.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(now / 220);
    animating = !live.reducedMotion;
    let from = head;
    live.guide.forEach((c, i) => {
      guideSquare(ctx, geo, c, from, i === 0 ? pulse : 0.55 / (i + 1), live.guideBack);
      from = c;
    });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(top, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!live.reducedMotion && live.popCell >= 0 && now - live.popAt < 140) {
    animating = true;
    const t = (now - live.popAt) / 140;
    const [px, py] = centre(geo, live.popCell);
    ctx.strokeStyle = `rgba(204, 26, 46, ${0.5 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, woolWidth(geo) * (0.6 + t * 0.7), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!live.solved && live.dragging) {
    // The wool lifts off the page and follows the finger.
    const fx = Math.min(Math.max(live.fx, geo.pad), geo.edge - geo.pad);
    const fy = Math.min(Math.max(live.fy, geo.pad), geo.edge - geo.pad);
    if (Math.hypot(fx - hx, fy - hy) > cell * 0.18) {
      drawWool(ctx, [[hx, hy], [fx, fy]], woolWidth(geo) * 0.92, { lift: 1, fuzz: false });
    }
  }

  if (live.empty.length > 0) {
    // Marigold pencil hatching on every square still to fill, gently pulsing.
    animating = animating || !live.reducedMotion;
    const pulse = live.reducedMotion ? 0.8 : 0.6 + 0.3 * Math.sin(now / 260);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#E8940C';
    ctx.lineWidth = Math.max(2, cell * 0.05);
    ctx.lineCap = 'round';
    for (const c of live.empty) {
      const x0 = geo.pad + (c % geo.size) * cell;
      const y0 = geo.pad + Math.floor(c / geo.size) * cell;
      const inset = cell * 0.14;
      ctx.beginPath();
      ctx.roundRect(x0 + inset, y0 + inset, cell - inset * 2, cell - inset * 2, cell * 0.12);
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      for (let k = -cell; k < cell; k += cell * 0.16) {
        ctx.moveTo(x0 + k, y0 + cell);
        ctx.lineTo(x0 + k + cell, y0);
      }
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(x0 + inset, y0 + inset, cell - inset * 2, cell - inset * 2, cell * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (drawSolveGlow(ctx, geo, thread, live, now)) animating = true;

  if (live.hintCell >= 0 && now < live.hintUntil) {
    animating = true;
    const [x, y] = centre(geo, live.hintCell);
    const pulse = live.reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(now / 110);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = Math.max(4, cell * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  return animating;
};

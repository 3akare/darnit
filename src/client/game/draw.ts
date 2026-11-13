// Canvas drawing for the board, in the sketchbook look: white paper with a pencil grid and
// pricked holes, red wool laid along the thread and held down with clear tape, glossy black
// buttons, and black running-stitch seams. Everything is drawn in code; no image files.

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
const FUZZ = [
  'rgba(214, 34, 54, 0.55)',
  'rgba(170, 14, 32, 0.45)',
  'rgba(245, 110, 120, 0.4)',
  'rgba(130, 8, 24, 0.38)',
];

/**
 * A length of red wool through the given points: cast shadow, rounded body, twisted plies
 * and loose fibres. `seed` keeps the fibres still from frame to frame. `lift` (0 to 1)
 * raises the wool off the page, for the part being pulled by the finger.
 */
export const drawWool = (ctx: Ctx, pts: readonly Pt[], w: number, seed: number, lift = 0): void => {
  if (pts.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shadow on the paper: two soft offset strokes, cheaper than a blur.
  const sx = w * 0.08 + lift * 3;
  const sy = w * 0.2 + lift * 7;
  ctx.strokeStyle = WOOL.shadow;
  ctx.lineWidth = w * 1.15;
  tracePts(ctx, pts, sx, sy);
  ctx.stroke();
  ctx.lineWidth = w * 0.9;
  tracePts(ctx, pts, sx * 0.55, sy * 0.55);
  ctx.stroke();

  // Body, shading from the edges to the middle so it reads as round.
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

  // Twisted plies: soft slanted grooves with a highlight beside each, slightly uneven.
  const rnd = seeded(seed);
  const dark = new Path2D();
  const light = new Path2D();
  const fibresDark = new Path2D();
  const fibresLight = new Path2D();
  const step = w * 0.55;
  let phase = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1] ?? [0, 0];
    const [bx, by] = pts[k] ?? [0, 0];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const nx = -uy;
    const ny = ux;
    const h = w * 0.4;
    const lean = w * 0.3;
    for (let s = (step - phase) % step; s < len; s += step * (0.85 + rnd() * 0.3)) {
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
    // Fine fibres running along the strand, inside the body.
    const fibres = Math.ceil(len / (w * 0.09));
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
    phase = (phase + len) % step;
  }
  ctx.lineWidth = Math.max(0.5, w * 0.04);
  ctx.strokeStyle = WOOL.fibreDark;
  ctx.stroke(fibresDark);
  ctx.strokeStyle = WOOL.fibreLight;
  ctx.stroke(fibresLight);
  ctx.strokeStyle = WOOL.twistDark;
  ctx.lineWidth = Math.max(0.8, w * 0.11);
  ctx.stroke(dark);
  ctx.strokeStyle = WOOL.twistLight;
  ctx.lineWidth = Math.max(0.7, w * 0.08);
  ctx.stroke(light);

  // Fuzz: loose fibres standing off the edges, and a few lying across the body.
  const strands = FUZZ.map(() => new Path2D());
  const over = new Path2D();
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1] ?? [0, 0];
    const [bx, by] = pts[k] ?? [0, 0];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const count = Math.ceil(len / (w * 0.08));
    for (let i = 0; i < count; i++) {
      const t = rnd() * len;
      const side = rnd() < 0.5 ? -1 : 1;
      const nx = -uy * side;
      const ny = ux * side;
      const off = w * (0.3 + rnd() * 0.2);
      const bxp = ax + ux * t + nx * off;
      const byp = ay + uy * t + ny * off;
      const turn = (rnd() - 0.5) * 1.8;
      const dx = nx * Math.cos(turn) - ny * Math.sin(turn);
      const dy = nx * Math.sin(turn) + ny * Math.cos(turn);
      const length = w * (0.06 + rnd() * rnd() * 0.75);
      const bend = (rnd() - 0.5) * length * 0.8;
      const path = strands[Math.floor(rnd() * strands.length)] ?? over;
      path.moveTo(bxp, byp);
      path.quadraticCurveTo(bxp + dx * length * 0.5 + ux * bend, byp + dy * length * 0.5 + uy * bend, bxp + dx * length, byp + dy * length);
    }
    for (let i = 0; i < count * 0.5; i++) {
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
  ctx.lineWidth = Math.max(0.45, w * 0.03);
  strands.forEach((path, i) => {
    ctx.strokeStyle = FUZZ[i] ?? WOOL.body;
    ctx.stroke(path);
  });
  ctx.strokeStyle = 'rgba(255, 130, 130, 0.35)';
  ctx.stroke(over);
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
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-hl + tear, -hw + 1.2);
  ctx.lineTo(hl - tear, -hw + 1.2);
  ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------- buttons

/** A glossy black button with a white number. */
const drawButton = (ctx: Ctx, geo: Geometry, x: number, y: number, n: number): void => {
  const r = geo.cell * 0.36;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
  ctx.shadowBlur = r * 0.4 * geo.dpr;
  ctx.shadowOffsetX = r * 0.06 * geo.dpr;
  ctx.shadowOffsetY = r * 0.18 * geo.dpr;
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.08, x, y, r);
  body.addColorStop(0, '#5B5963');
  body.addColorStop(0.55, '#242329');
  body.addColorStop(1, '#0C0B0F');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.36, y - r * 0.48, r * 0.34, r * 0.15, -0.55, 0, Math.PI * 2);
  ctx.fill();

  const fontPx = Math.max(16, Math.round(geo.cell * 0.4));
  ctx.font = `700 ${fontPx}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillText(String(n), x, y + 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(n), x, y + 1);
};

const ringPoints = (x: number, y: number, r: number, count: number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
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

/**
 * Split the thread where it comes back to a cross-stitch cell, so the second pass is drawn
 * over the first and the crossing shows.
 */
const runsOf = (board: Board, thread: readonly number[]): number[][] => {
  const runs: number[][] = [];
  let current: number[] = [];
  const seen = new Set<number>();
  thread.forEach((c, i) => {
    const before = thread[i - 1];
    if (board.isCross[c] && seen.has(c) && before !== undefined) {
      runs.push(current);
      current = [before];
    }
    seen.add(c);
    current.push(c);
  });
  runs.push(current);
  return runs;
};

/** Everything that changes only when the thread changes: wool, tape, buttons, marks. */
export const drawThreadLayer = (geo: Geometry, board: Board, thread: readonly number[], solved: boolean): HTMLCanvasElement => {
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
  drawWool(ctx, [[sx, sy], tailEnd], w, first * 7 + 3);
  frayedEnd(ctx, tailEnd[0], tailEnd[1], cx / Math.SQRT2, cy / Math.SQRT2, w, first);

  runsOf(board, thread).forEach((run, i) => {
    drawWool(ctx, run.map((c) => centre(geo, c)), w, (run[0] ?? 0) * 977 + i * 131 + 11);
  });

  // Cross-stitch cells with one pass done: show the pass still owed, above the wool.
  const passes = new Map<number, number>();
  thread.forEach((c, i) => {
    if (!board.isCross[c]) return;
    passes.set(c, (passes.get(c) ?? 0) + 1);
    if ((passes.get(c) ?? 0) === 1) {
      const neighbour = thread[i - 1] ?? thread[i + 1];
      const dir = neighbour === undefined ? -1 : directionBetween(board, neighbour, c);
      passes.set(c, dir === RIGHT || dir === LEFT ? 1 : -1);
    } else {
      passes.set(c, 2);
    }
  });
  for (const [c, state] of passes) {
    if (state === 2) continue;
    const [x, y] = centre(geo, c);
    // state 1: first pass went across, so the owed pass is up-down.
    owedPass(ctx, x, y, cell, state !== 1);
  }

  const reached = new Set(thread);
  board.buttons.forEach((c, n) => {
    const [x, y] = centre(geo, c);
    drawButton(ctx, geo, x, y, n + 1);
    if (reached.has(c)) drawWool(ctx, ringPoints(x, y, cell * 0.37, 28), w * 0.2, c * 13 + 5);
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

/** A steel needle. The eye sits at (x, y) and the point aims along (ux, uy). */
export const drawNeedle = (ctx: Ctx, geo: Geometry, x: number, y: number, ux: number, uy: number, len: number): void => {
  const w = Math.max(3, len * 0.08);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(uy, ux));
  const shape = new Path2D();
  shape.moveTo(-w * 0.9, -w * 0.5);
  shape.lineTo(len * 0.72, -w * 0.4);
  shape.lineTo(len, 0);
  shape.lineTo(len * 0.72, w * 0.4);
  shape.lineTo(-w * 0.9, w * 0.5);
  shape.arc(-w * 0.9, 0, w * 0.5, Math.PI / 2, -Math.PI / 2);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 3 * geo.dpr;
  ctx.shadowOffsetX = 1.5 * geo.dpr;
  ctx.shadowOffsetY = 3 * geo.dpr;
  const steel = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  steel.addColorStop(0, '#F7F9FB');
  steel.addColorStop(0.4, '#B9C0C8');
  steel.addColorStop(1, '#5E666F');
  ctx.fillStyle = steel;
  ctx.fill(shape);
  ctx.restore();
  ctx.fillStyle = 'rgba(30, 30, 36, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, 0, w * 0.75, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(w, -w * 0.22);
  ctx.lineTo(len * 0.78, -w * 0.12);
  ctx.stroke();
  ctx.restore();
};

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
};

/** Draw one frame. Returns true while something is still animating. */
export const drawFrame = (
  ctx: Ctx,
  geo: Geometry,
  thread: readonly number[],
  backdrop: HTMLCanvasElement,
  layer: HTMLCanvasElement,
  live: Live,
  now: number
): boolean => {
  const { cell, dpr } = geo;
  let animating = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(backdrop, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const head = thread[thread.length - 1] ?? 0;
  const [hx, hy] = centre(geo, head);

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

  if (!live.solved) {
    const fx = Math.min(Math.max(live.fx, geo.pad), geo.edge - geo.pad);
    const fy = Math.min(Math.max(live.fy, geo.pad), geo.edge - geo.pad);
    const reach = Math.hypot(fx - hx, fy - hy);
    if (live.dragging && reach > cell * 0.18) {
      // The wool lifts off the page and follows the finger, with the needle at its end.
      const ux = (fx - hx) / reach;
      const uy = (fy - hy) / reach;
      drawWool(ctx, [[hx, hy], [fx, fy]], woolWidth(geo) * 0.92, 4242, 1);
      drawNeedle(ctx, geo, fx, fy, ux, uy, cell * 0.8);
    } else {
      const before = thread[thread.length - 2];
      let ux = Math.SQRT1_2;
      let uy = -Math.SQRT1_2;
      if (before !== undefined) {
        const [bx, by] = centre(geo, before);
        const d = Math.hypot(hx - bx, hy - by) || 1;
        const a = Math.atan2((hy - by) / d, (hx - bx) / d) - 0.65;
        ux = Math.cos(a);
        uy = Math.sin(a);
      }
      drawNeedle(ctx, geo, hx + ux * cell * 0.12, hy + uy * cell * 0.12, ux, uy, cell * 0.62);
    }
  }

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

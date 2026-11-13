// Canvas drawing for the fabric: hoop, aida cloth, seams, cross-stitch marks, the thread,
// buttons and the needle. Everything is drawn in code; there are no image files.

import { seamBelow, seamRight } from '../../shared/puzzle/pattern.ts';
import type { Board, Pattern } from '../../shared/puzzle/pattern.ts';

export type Theme = {
  fabric: string;
  cloth: string;
  hole: string;
  text: string;
  thread: string;
  threadDark: string;
  seam: string;
  hoop: string;
  hoopEdge: string;
  button: string;
  dark: boolean;
};

export const readTheme = (el: Element): Theme => {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    fabric: v('--fabric', '#F7F3EA'),
    cloth: v('--cloth', '#EFE9DB'),
    hole: v('--hole', 'rgba(0,0,0,0.16)'),
    text: v('--text', '#1F1B24'),
    thread: v('--thread', '#FF5A4E'),
    threadDark: v('--thread-dark', '#B8362C'),
    seam: v('--seam', '#2B2730'),
    hoop: v('--hoop', '#D9B48A'),
    hoopEdge: v('--hoop-edge', '#B98F63'),
    button: v('--button', '#FFFFFF'),
    dark: v('--is-dark', '0') === '1',
  };
};

export type Geometry = {
  /** Canvas edge in CSS pixels. */
  edge: number;
  /** Hoop width plus cloth margin. */
  pad: number;
  cell: number;
  dpr: number;
  size: number;
};

export const layout = (edge: number, size: number): Geometry => {
  const pad = Math.max(10, Math.round(edge * 0.04));
  return { edge, pad, cell: (edge - 2 * pad) / size, dpr: Math.min(window.devicePixelRatio || 1, 3), size };
};

export const centre = (geo: Geometry, cell: number): [number, number] => [
  geo.pad + ((cell % geo.size) + 0.5) * geo.cell,
  geo.pad + (Math.floor(cell / geo.size) + 0.5) * geo.cell,
];

/**
 * The cell under a point, or -1. Points close to a cell's edge count as no cell, so a
 * finger cutting a corner does not stitch the cell it only grazed.
 */
export const cellAt = (geo: Geometry, x: number, y: number): number => {
  const fx = (x - geo.pad) / geo.cell;
  const fy = (y - geo.pad) / geo.cell;
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  if (col < 0 || row < 0 || col >= geo.size || row >= geo.size) return -1;
  const inset = 0.14;
  const ox = fx - col;
  const oy = fy - row;
  if (ox < inset || ox > 1 - inset || oy < inset || oy > 1 - inset) return -1;
  return row * geo.size + col;
};

/** The parts that never change during play, drawn once to an offscreen canvas. */
export const drawBackdrop = (geo: Geometry, pattern: Pattern, theme: Theme): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geo.edge * geo.dpr);
  canvas.height = Math.round(geo.edge * geo.dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(geo.dpr, geo.dpr);
  const { edge, pad, cell, size } = geo;

  // Hoop: light wood, rounded square, brass screw at the top.
  ctx.fillStyle = theme.hoop;
  ctx.beginPath();
  ctx.roundRect(0, 0, edge, edge, pad * 1.6);
  ctx.fill();
  ctx.strokeStyle = theme.hoopEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, edge - 1, edge - 1, pad * 1.6);
  ctx.stroke();
  ctx.fillStyle = '#C9A227';
  ctx.fillRect(edge / 2 - pad * 0.7, 0, pad * 1.4, pad * 0.42);

  // Aida cloth.
  const inner = pad * 0.72;
  ctx.fillStyle = theme.cloth;
  ctx.beginPath();
  ctx.roundRect(inner, inner, edge - 2 * inner, edge - 2 * inner, pad * 0.9);
  ctx.fill();

  // Four tiny corner holes in every cell, like real aida.
  ctx.fillStyle = theme.hole;
  const inset = cell * 0.13;
  for (let i = 0; i < size * size; i++) {
    const x0 = pad + (i % size) * cell;
    const y0 = pad + Math.floor(i / size) * cell;
    for (const [dx, dy] of [
      [inset, inset],
      [cell - inset, inset],
      [inset, cell - inset],
      [cell - inset, cell - inset],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x0 + dx, y0 + dy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cross-stitch cells: a faint printed X, like a pattern chart.
  ctx.strokeStyle = theme.seam;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const c of pattern.crosses) {
    const [x, y] = centre(geo, c);
    const r = cell * 0.26;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Seams: bold charcoal running stitch between cells.
  ctx.strokeStyle = theme.seam;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.setLineDash([cell * 0.2, cell * 0.14]);
  const seams = new Set(pattern.seams);
  for (let i = 0; i < size * size; i++) {
    const x0 = pad + (i % size) * cell;
    const y0 = pad + Math.floor(i / size) * cell;
    const trim = cell * 0.08;
    if (seams.has(seamRight(i))) {
      ctx.beginPath();
      ctx.moveTo(x0 + cell, y0 + trim);
      ctx.lineTo(x0 + cell, y0 + cell - trim);
      ctx.stroke();
    }
    if (seams.has(seamBelow(i))) {
      ctx.beginPath();
      ctx.moveTo(x0 + trim, y0 + cell);
      ctx.lineTo(x0 + cell - trim, y0 + cell);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  return canvas;
};

export type Scene = {
  thread: readonly number[];
  /** performance.now() when each thread position was stitched, for the pull-through pop. */
  stitchedAt: readonly number[];
  /** Cell to flash as a hint, and when the flash ends. */
  hintCell: number;
  hintUntil: number;
  solved: boolean;
  reducedMotion: boolean;
};

const tracePath = (ctx: CanvasRenderingContext2D, geo: Geometry, thread: readonly number[], dx: number, dy: number): void => {
  ctx.beginPath();
  thread.forEach((c, k) => {
    const [x, y] = centre(geo, c);
    if (k === 0) ctx.moveTo(x + dx, y + dy);
    else ctx.lineTo(x + dx, y + dy);
  });
  if (thread.length === 1) {
    const [x, y] = centre(geo, thread[0] ?? 0);
    ctx.lineTo(x + dx + 0.01, y + dy);
  }
};

/** Draw one frame. Returns true while something is still animating. */
export const drawScene = (
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  board: Board,
  backdrop: HTMLCanvasElement,
  theme: Theme,
  scene: Scene,
  now: number
): boolean => {
  const { cell, dpr } = geo;
  const { thread } = scene;
  let animating = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(backdrop, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const width = cell * 0.55;

  // Thread: soft shadow, satin band, short diagonal stitches, 1px highlight.
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth = width + 2;
  tracePath(ctx, geo, thread, 0, 2);
  ctx.stroke();
  ctx.strokeStyle = theme.thread;
  ctx.lineWidth = width;
  tracePath(ctx, geo, thread, 0, 0);
  ctx.stroke();

  ctx.strokeStyle = theme.threadDark;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  const half = width / 2 - 1.5;
  for (let k = 1; k < thread.length; k++) {
    const [ax, ay] = centre(geo, thread[k - 1] ?? 0);
    const [bx, by] = centre(geo, thread[k] ?? 0);
    const ux = (bx - ax) / cell;
    const uy = (by - ay) / cell;
    const lean = cell * 0.07;
    for (let s = 0; s < 6; s++) {
      const t = (s + 0.5) / 6;
      const mx = ax + (bx - ax) * t;
      const my = ay + (by - ay) * t;
      ctx.moveTo(mx + uy * half - ux * lean, my - ux * half - uy * lean);
      ctx.lineTo(mx - uy * half + ux * lean, my + ux * half + uy * lean);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = 1;
  tracePath(ctx, geo, thread, -width * 0.22, -width * 0.22);
  ctx.stroke();

  // New cell: the stitch pulls through in 80 ms with a small pop.
  if (!scene.reducedMotion) {
    for (let k = Math.max(1, thread.length - 4); k < thread.length; k++) {
      const age = now - (scene.stitchedAt[k] ?? 0);
      if (age >= 0 && age < 80) {
        animating = true;
        const [x, y] = centre(geo, thread[k] ?? 0);
        ctx.fillStyle = theme.thread;
        ctx.beginPath();
        ctx.arc(x, y, (width / 2) * (1 + 0.32 * (1 - age / 80)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // A cross-stitch cell with both passes done becomes a bold thread X.
  const passes = new Map<number, number>();
  for (const c of thread) if (board.isCross[c]) passes.set(c, (passes.get(c) ?? 0) + 1);
  ctx.strokeStyle = theme.threadDark;
  ctx.lineWidth = 3;
  for (const [c, n] of passes) {
    if (n < 2) continue;
    const [x, y] = centre(geo, c);
    const r = cell * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
  }

  // Buttons: white four-hole buttons with a dark number, sewn on once the thread reaches them.
  const onThread = new Set(thread);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(16, Math.round(cell * 0.38))}px "Space Grotesk", system-ui, sans-serif`;
  board.buttons.forEach((c, n) => {
    const [x, y] = centre(geo, c);
    const r = cell * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x, y + 1.5, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.button;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    if (onThread.has(c)) {
      ctx.strokeStyle = theme.thread;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#1F1B24';
    ctx.fillText(String(n + 1), x, y + 1);
  });

  // The needle rides the leading end.
  const head = thread[thread.length - 1];
  if (head !== undefined && !scene.solved) {
    const [hx, hy] = centre(geo, head);
    const before = thread[thread.length - 2];
    let ux = 0.7;
    let uy = -0.7;
    if (before !== undefined) {
      const [px, py] = centre(geo, before);
      ux = (hx - px) / cell;
      uy = (hy - py) / cell;
    }
    const from = (board.buttonIndex[head] ?? -1) >= 0 ? cell * 0.35 : 0;
    ctx.strokeStyle = theme.dark ? '#D5DCE4' : '#7C8792';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx + ux * from, hy + uy * from);
    ctx.lineTo(hx + ux * (from + cell * 0.36), hy + uy * (from + cell * 0.36));
    ctx.stroke();
  }

  // Hint: flash the next correct cell.
  if (scene.hintCell >= 0 && now < scene.hintUntil) {
    animating = true;
    const [x, y] = centre(geo, scene.hintCell);
    const phase = scene.reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(now / 110);
    ctx.strokeStyle = theme.thread;
    ctx.globalAlpha = phase;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - cell * 0.36, y - cell * 0.36, cell * 0.72, cell * 0.72, cell * 0.16);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  return animating;
};

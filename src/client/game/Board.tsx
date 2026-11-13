// The fabric: a canvas that draws the pattern and turns finger movement into stitches.
// Pointer events with touch-action: none, so the page never scrolls while drawing. This
// component is only mounted in expanded mode, where capturing gestures is allowed.

import { useEffect, useRef } from 'react';
import { directionBetween } from '../../shared/puzzle/pattern.ts';
import type { Board as CompiledBoard, Pattern } from '../../shared/puzzle/pattern.ts';
import { cellAt, drawBackdrop, drawScene, layout, readTheme } from './draw.ts';
import type { Geometry, Scene, Theme } from './draw.ts';

type Props = {
  pattern: Pattern;
  board: CompiledBoard;
  thread: readonly number[];
  hintCell: number;
  hintUntil: number;
  solved: boolean;
  locked: boolean;
  /** The finger moved onto this cell while drawing. */
  onDrag: (cell: number) => void;
  /** A clean tap on an earlier cell of the thread. */
  onCut: (cell: number) => void;
};

export const Board = ({ pattern, board, thread, hintCell, hintUntil, solved, locked, onDrag, onCut }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ thread, hintCell, hintUntil, solved, locked, onDrag, onCut });
  const stitchedAt = useRef<number[]>([]);
  const invalidate = useRef<() => void>(() => {});

  useEffect(() => {
    // Stamp newly stitched positions so they can pop, and forget unpicked ones.
    const times = stitchedAt.current;
    const now = performance.now();
    times.length = Math.min(times.length, thread.length);
    while (times.length < thread.length) times.push(times.length === 0 ? 0 : now);
    live.current = { thread, hintCell, hintUntil, solved, locked, onDrag, onCut };
    invalidate.current();
  }, [thread, hintCell, hintUntil, solved, locked, onDrag, onCut]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const box = canvas?.parentElement;
    if (!canvas || !ctx || !box) return;

    let geo: Geometry = layout(100, pattern.size);
    let theme: Theme = readTheme(canvas);
    let backdrop = document.createElement('canvas');
    let raf = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now: number) => {
      raf = 0;
      const state = live.current;
      const scene: Scene = {
        thread: state.thread,
        stitchedAt: stitchedAt.current,
        hintCell: state.hintCell,
        hintUntil: state.hintUntil,
        solved: state.solved,
        reducedMotion,
      };
      if (drawScene(ctx, geo, board, backdrop, theme, scene, now)) schedule();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    invalidate.current = schedule;

    const resize = () => {
      const rect = box.getBoundingClientRect();
      const edge = Math.floor(Math.min(rect.width, rect.height));
      if (edge <= 0) return;
      geo = layout(edge, pattern.size);
      theme = readTheme(canvas);
      canvas.style.width = `${edge}px`;
      canvas.style.height = `${edge}px`;
      canvas.width = Math.round(edge * geo.dpr);
      canvas.height = Math.round(edge * geo.dpr);
      backdrop = drawBackdrop(geo, pattern, theme);
      schedule();
    };

    // --- finger handling
    let armed = false; // true once this gesture is attached to the head of the thread
    let lastCell = -1;
    let tapCell = -1; // an earlier thread cell pressed and not yet moved off

    const cellOf = (e: PointerEvent): number => {
      const rect = canvas.getBoundingClientRect();
      return cellAt(geo, e.clientX - rect.left, e.clientY - rect.top);
    };
    const headOf = (): number => live.current.thread[live.current.thread.length - 1] ?? -1;
    const nextToHead = (cell: number): boolean => directionBetween(board, headOf(), cell) >= 0;

    const visit = (cell: number) => {
      if (cell < 0) return;
      if (cell !== tapCell) tapCell = -1;
      if (!armed) {
        if (cell === headOf()) armed = true;
        else if (nextToHead(cell) && !live.current.thread.includes(cell)) armed = true;
        else return;
      }
      if (cell === lastCell) return;
      lastCell = cell;
      if (cell !== headOf()) live.current.onDrag(cell);
    };

    const onDown = (e: PointerEvent) => {
      if (live.current.locked) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      armed = false;
      lastCell = -1;
      tapCell = -1;
      const cell = cellOf(e);
      if (cell < 0) return;
      const t = live.current.thread;
      if (cell !== headOf() && t.includes(cell)) {
        // Pressing an earlier part of the thread never changes it on its own.
        tapCell = cell;
        return;
      }
      visit(cell);
    };
    const onMove = (e: PointerEvent) => {
      if (live.current.locked || e.buttons === 0) return;
      const batch = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      if (batch.length > 1) for (const each of batch) visit(cellOf(each));
      else visit(cellOf(e));
    };
    const onUp = (e: PointerEvent) => {
      if (!live.current.locked && tapCell >= 0 && cellOf(e) === tapCell) live.current.onCut(tapCell);
      armed = false;
      tapCell = -1;
    };
    const onCancel = () => {
      armed = false;
      tapCell = -1;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(box);
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', resize);
    void document.fonts.ready.then(schedule);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    resize();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      scheme.removeEventListener('change', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      invalidate.current = () => {};
    };
  }, [pattern, board]);

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="fabric" aria-label="Pattern fabric" />
    </div>
  );
};

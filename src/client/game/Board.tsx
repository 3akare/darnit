// The board: a canvas that draws the pattern and turns finger movement into stitches.
//
// The board applies drag steps itself and redraws in the same frame, then tells the play
// screen, so drawing never waits on a React render. Pointer events with touch-action: none
// keep the page still while drawing; this component is only mounted in expanded mode,
// where capturing gestures is allowed.

import { useEffect, useRef } from 'react';
import { directionBetween } from '../../shared/puzzle/pattern.ts';
import type { Board as CompiledBoard, Pattern } from '../../shared/puzzle/pattern.ts';
import { cutTo, dragTo } from '../../shared/puzzle/stitching.ts';
import type { Stitch } from '../../shared/puzzle/stitching.ts';
import { cellAt, centre, drawBackdrop, drawFrame, drawThreadLayer, layout } from './draw.ts';
import type { Geometry, Live } from './draw.ts';

type Props = {
  pattern: Pattern;
  board: CompiledBoard;
  thread: readonly number[];
  hintCell: number;
  hintUntil: number;
  solved: boolean;
  locked: boolean;
  /** Every change the finger makes: drag steps and taps that cut the thread back. */
  onStitch: (stitch: Stitch) => void;
};

const buzz = (ms: number): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every webview allows vibration. It is only a nicety.
  }
};

export const Board = ({ pattern, board, thread, hintCell, hintUntil, solved, locked, onStitch }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threadRef = useRef<readonly number[]>(thread);
  const props = useRef({ solved, locked, onStitch });
  const live = useRef<Live>({
    dragging: false,
    fx: 0,
    fy: 0,
    hintCell,
    hintUntil,
    popCell: -1,
    popAt: 0,
    solved,
    reducedMotion: false,
  });
  const refresh = useRef<(layerChanged: boolean) => void>(() => {});

  useEffect(() => {
    props.current = { solved, locked, onStitch };
    live.current.hintCell = hintCell;
    live.current.hintUntil = hintUntil;
    const solvedChanged = live.current.solved !== solved;
    live.current.solved = solved;
    // Undo, Reset and hints change the thread from outside the board.
    const threadChanged = threadRef.current !== thread;
    threadRef.current = thread;
    refresh.current(threadChanged || solvedChanged);
  }, [thread, hintCell, hintUntil, solved, locked, onStitch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const box = canvas?.parentElement;
    if (!canvas || !ctx || !box) return;

    let geo: Geometry = layout(100, pattern.size);
    let backdrop = document.createElement('canvas');
    let layer = document.createElement('canvas');
    let layerStale = true;
    let raf = 0;
    live.current.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now: number) => {
      raf = 0;
      if (layerStale) {
        layer = drawThreadLayer(geo, board, threadRef.current, live.current.solved);
        layerStale = false;
      }
      if (drawFrame(ctx, geo, threadRef.current, backdrop, layer, live.current, now)) schedule();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    refresh.current = (layerChanged: boolean) => {
      if (layerChanged) layerStale = true;
      schedule();
    };

    const resize = () => {
      const rect = box.getBoundingClientRect();
      const edge = Math.floor(Math.min(rect.width, rect.height));
      if (edge <= 0) return;
      geo = layout(edge, pattern.size);
      canvas.style.width = `${edge}px`;
      canvas.style.height = `${edge}px`;
      canvas.width = Math.round(edge * geo.dpr);
      canvas.height = Math.round(edge * geo.dpr);
      backdrop = drawBackdrop(geo, pattern);
      layerStale = true;
      schedule();
    };

    // --- finger handling
    let armed = false; // this gesture is attached to the head of the thread
    let lastCell = -1;
    let tapCell = -1; // an earlier thread cell pressed and not yet moved off

    const point = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    const head = (): number => threadRef.current[threadRef.current.length - 1] ?? -1;

    const commit = (stitch: Stitch) => {
      if (stitch.added === 0 && stitch.removed === 0) return;
      const before = threadRef.current;
      threadRef.current = stitch.thread;
      if (stitch.added > 0) {
        const newest = stitch.thread[stitch.thread.length - 1] ?? -1;
        live.current.popCell = newest;
        live.current.popAt = performance.now();
        buzz((board.buttonIndex[newest] ?? -1) >= 0 ? 14 : 4);
      } else if (before.length > stitch.thread.length) {
        live.current.popCell = -1;
      }
      layerStale = true;
      schedule();
      props.current.onStitch(stitch);
    };

    const visit = (x: number, y: number) => {
      const cell = cellAt(geo, x, y, lastCell);
      if (cell < 0) return;
      if (cell !== tapCell) tapCell = -1;
      if (!armed) {
        const h = head();
        const [hx, hy] = centre(geo, h);
        const nearHead = Math.hypot(x - hx, y - hy) < geo.cell * 0.75;
        const freeNeighbour = directionBetween(board, h, cell) >= 0 && !threadRef.current.includes(cell);
        if (!nearHead && !freeNeighbour) return;
        armed = true;
        live.current.dragging = true;
      }
      if (cell === lastCell) return;
      lastCell = cell;
      if (cell !== head()) commit(dragTo(board, threadRef.current, cell));
    };

    const onDown = (e: PointerEvent) => {
      if (props.current.locked) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      armed = false;
      lastCell = -1;
      tapCell = -1;
      const [x, y] = point(e);
      live.current.fx = x;
      live.current.fy = y;
      const cell = cellAt(geo, x, y);
      const t = threadRef.current;
      if (cell >= 0 && cell !== head() && t.includes(cell)) {
        // Pressing an earlier part of the thread never changes it on its own; a clean tap cuts.
        tapCell = cell;
        lastCell = cell;
        return;
      }
      visit(x, y);
      schedule();
    };

    const onMove = (e: PointerEvent) => {
      if (props.current.locked || e.buttons === 0) return;
      const batch = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const each of batch.length > 1 ? batch : [e]) {
        const [x, y] = point(each);
        visit(x, y);
      }
      const [x, y] = point(e);
      live.current.fx = x;
      live.current.fy = y;
      if (armed) schedule();
    };

    const release = () => {
      armed = false;
      tapCell = -1;
      live.current.dragging = false;
      schedule();
    };
    const onUp = (e: PointerEvent) => {
      if (!props.current.locked && tapCell >= 0) {
        const [x, y] = point(e);
        if (cellAt(geo, x, y) === tapCell) commit(cutTo(threadRef.current, tapCell));
      }
      release();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(box);
    void document.fonts.ready.then(() => {
      layerStale = true;
      schedule();
    });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', release);
    resize();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', release);
      refresh.current = () => {};
    };
  }, [pattern, board]);

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="board" aria-label="Pattern board" />
    </div>
  );
};

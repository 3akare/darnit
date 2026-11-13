// The board: a canvas that draws the pattern and turns finger movement into stitches.
//
// The board applies drag steps itself and redraws in the same frame, then tells the play
// screen, so drawing never waits on a React render. Pointer events with touch-action: none
// keep the page still while drawing; this component is only mounted in expanded mode,
// where capturing gestures is allowed.

import { useEffect, useRef, useState } from 'react';
import { directionBetween } from '../../shared/puzzle/pattern.ts';
import type { Board as CompiledBoard, Pattern } from '../../shared/puzzle/pattern.ts';
import { cutTo, dragTo } from '../../shared/puzzle/stitching.ts';
import type { Stitch } from '../../shared/puzzle/stitching.ts';
import {
  cellAt,
  centre,
  drawBackdrop,
  drawFrame,
  drawThreadRange,
  drawTopLayer,
  layout,
  newLayer,
  topLayerKey,
} from './draw.ts';
import type { Geometry, Live } from './draw.ts';

type Props = {
  pattern: Pattern;
  board: CompiledBoard;
  thread: readonly number[];
  hintCell: number;
  hintUntil: number;
  solved: boolean;
  locked: boolean;
  /** Squares to hatch because the thread reached the last button too early. */
  empty: readonly number[];
  /** Practice board only: the next squares to take, or the one square to unpick back to. */
  guide?: readonly number[];
  guideBack?: boolean;
  /** Every change the finger makes: drag steps and taps that cut the thread back. */
  onStitch: (stitch: Stitch) => void;
};

const NONE: readonly number[] = [];

/** How many of the newest stitches are redrawn on every change; older wool is cached. */
const RECENT = 4;

const buzz = (ms: number): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every webview allows vibration. It is only a nicety.
  }
};

export const Board = ({
  pattern,
  board,
  thread,
  hintCell,
  hintUntil,
  solved,
  locked,
  empty,
  guide = NONE,
  guideBack = false,
  onStitch,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Reopening a solved day shows the finished board still; only a solve on screen animates.
  const [solvedOnArrival] = useState(solved);
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
    empty,
    guide,
    guideBack,
    solvedAt: 0,
    buttons: pattern.buttons,
  });
  const refresh = useRef<(layerChanged: boolean) => void>(() => {});

  useEffect(() => {
    props.current = { solved, locked, onStitch };
    live.current.hintCell = hintCell;
    live.current.hintUntil = hintUntil;
    live.current.empty = empty;
    live.current.guide = guide;
    live.current.guideBack = guideBack;
    const solvedChanged = live.current.solved !== solved;
    // Only a solve that happens on screen gets the solve moment, not reopening a solved day.
    if (solvedChanged && solved && threadRef.current.length > 1) live.current.solvedAt = performance.now();
    live.current.solved = solved;
    // Undo, Reset and hints change the thread from outside the board.
    const threadChanged = threadRef.current !== thread;
    threadRef.current = thread;
    refresh.current(threadChanged || solvedChanged);
  }, [thread, hintCell, hintUntil, solved, locked, empty, guide, guideBack, onStitch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const box = canvas?.parentElement;
    if (!canvas || !ctx || !box) return;

    let geo: Geometry = layout(100, pattern.size);
    let backdrop = document.createElement('canvas');
    // Three layers: "under" is the paper plus the thread up to a checkpoint and is only ever
    // appended to; "recent" is the stretch after the checkpoint, cleared and redrawn on each
    // change; "top" is the buttons and marks, redrawn only when they change. Canvases are
    // reused rather than recreated, so a stitch allocates nothing.
    let under = document.createElement('canvas');
    let recent = document.createElement('canvas');
    let top = document.createElement('canvas');
    let checkpoint = 0;
    let baseThread: number[] = [];
    let topKey = '';
    let layerStale = true;

    const rebuildWool = () => {
      const t = threadRef.current;
      const last = t.length - 1;
      const baseValid =
        checkpoint <= last && baseThread.length === checkpoint + 1 && baseThread.every((c, i) => t[i] === c);
      const underCtx = under.getContext('2d');
      if (!baseValid && underCtx) {
        // The thread was unpicked past the checkpoint (or the board was resized): start the
        // base again a little behind the head.
        checkpoint = Math.max(0, last - RECENT);
        underCtx.setTransform(1, 0, 0, 1, 0, 0);
        underCtx.clearRect(0, 0, under.width, under.height);
        underCtx.drawImage(backdrop, 0, 0);
        underCtx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);
        drawThreadRange(underCtx, geo, board, t, 0, checkpoint);
        baseThread = t.slice(0, checkpoint + 1);
      } else if (last - checkpoint > RECENT + 5 && underCtx) {
        // The recent stretch has grown long: move most of it into the base.
        const next = last - RECENT;
        drawThreadRange(underCtx, geo, board, t, checkpoint, next);
        checkpoint = next;
        baseThread = t.slice(0, checkpoint + 1);
      }
      const recentCtx = recent.getContext('2d');
      if (recentCtx) {
        recentCtx.setTransform(1, 0, 0, 1, 0, 0);
        recentCtx.clearRect(0, 0, recent.width, recent.height);
        recentCtx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);
        // Start one stitch early so the join with the base is covered by fresh wool.
        drawThreadRange(recentCtx, geo, board, t, Math.max(0, checkpoint - 1), last);
      }

      const key = topLayerKey(board, t, live.current.solved);
      if (key !== topKey) {
        top = drawTopLayer(geo, board, t, live.current.solved);
        topKey = key;
      }
    };
    let raf = 0;
    live.current.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now: number) => {
      raf = 0;
      if (layerStale) {
        rebuildWool();
        layerStale = false;
      }
      if (drawFrame(ctx, geo, threadRef.current, [under, recent], top, live.current, now)) schedule();
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
      [under] = newLayer(geo);
      [recent] = newLayer(geo);
      baseThread = [];
      topKey = '';
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
    <div className={solved && !solvedOnArrival ? 'stage solving' : 'stage'}>
      <canvas ref={canvasRef} className="board" aria-label="Pattern board" />
    </div>
  );
};

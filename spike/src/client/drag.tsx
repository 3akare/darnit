// Drag-performance spike. Draws an 8x8 board (the SPEC's worst case) with the planned
// thread rendering, and measures frame pacing and input latency while a finger drags.
// No puzzle rules here: only the interaction the real play screen depends on.

import { useEffect, useRef, useState } from 'react';
import { median, percentile, report } from './lib';

const N = 8;
const THREAD = '#FF5A4E';
const BUTTON_CELLS = [0, 5, 10, 15, 19, 28, 33, 38, 44, 51, 57, 63];

type Mode = 'full' | 'simple';

type Agg = {
  drags: number;
  frames: number[];
  inputDelay: number[];
  events: number;
  coalesced: number;
  cells: number;
  unpicks: number;
};

const emptyAgg = (): Agg => ({
  drags: 0,
  frames: [],
  inputDelay: [],
  events: 0,
  coalesced: 0,
  cells: 0,
  unpicks: 0,
});

const summarise = (agg: Agg) => {
  const refresh = median(agg.frames);
  const mean = agg.frames.reduce((a, b) => a + b, 0) / Math.max(1, agg.frames.length);
  const long = agg.frames.filter((f) => f > refresh * 1.5).length;
  return {
    drags: agg.drags,
    frames: agg.frames.length,
    avgFps: mean ? Math.round(1000 / mean) : 0,
    refreshHz: refresh ? Math.round(1000 / refresh) : 0,
    p95FrameMs: +percentile(agg.frames, 95).toFixed(1),
    worstFrameMs: +Math.max(0, ...agg.frames).toFixed(1),
    longFramePct: agg.frames.length ? +((100 * long) / agg.frames.length).toFixed(1) : 0,
    inputToFrameAvgMs: +(
      agg.inputDelay.reduce((a, b) => a + b, 0) / Math.max(1, agg.inputDelay.length)
    ).toFixed(1),
    inputToFrameP95Ms: +percentile(agg.inputDelay, 95).toFixed(1),
    pointerEvents: agg.events,
    coalescedEvents: agg.coalesced,
    cellsAdded: agg.cells,
    unpicks: agg.unpicks,
  };
};

export const DragTest = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>('full');
  const resetRef = useRef<() => void>(() => {});
  const [mode, setMode] = useState<Mode>('full');
  const [verdict, setVerdict] = useState<string | null>(null);
  const evidenceRef = useRef<() => unknown>(() => ({}));

  useEffect(() => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    if (!canvas || !hud) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const colors = dark
      ? { cloth: '#252A4D', hole: 'rgba(255,255,255,0.16)', hoop: '#B98A5E', ink: '#1F1B24' }
      : { cloth: '#EFE9DB', hole: 'rgba(0,0,0,0.16)', hoop: '#D9B48A', ink: '#1F1B24' };

    // --- board state
    let path: number[] = [];
    const index = new Int16Array(N * N).fill(-1);
    const addedAt = new Float64Array(N * N);

    // --- geometry (CSS pixels)
    let size = 0;
    let pad = 0;
    let cell = 0;
    let dpr = 1;
    let backdrop: HTMLCanvasElement | null = null;

    const center = (i: number): [number, number] => [
      pad + ((i % N) + 0.5) * cell,
      pad + (Math.floor(i / N) + 0.5) * cell,
    ];

    const cellAt = (x: number, y: number): number => {
      const c = Math.floor((x - pad) / cell);
      const r = Math.floor((y - pad) / cell);
      if (c < 0 || r < 0 || c >= N || r >= N) return -1;
      return r * N + c;
    };

    const buildBackdrop = () => {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const b = off.getContext('2d');
      if (!b) return;
      b.scale(dpr, dpr);
      // hoop
      b.fillStyle = colors.hoop;
      b.beginPath();
      b.roundRect(0, 0, size, size, 22);
      b.fill();
      // brass screw
      b.fillStyle = '#C9A227';
      b.fillRect(size / 2 - 9, 0, 18, 6);
      // aida cloth
      b.fillStyle = colors.cloth;
      b.beginPath();
      b.roundRect(pad - 3, pad - 3, size - 2 * pad + 6, size - 2 * pad + 6, 12);
      b.fill();
      // four corner holes per cell
      b.fillStyle = colors.hole;
      const inset = cell * 0.12;
      for (let i = 0; i < N * N; i++) {
        const x0 = pad + (i % N) * cell;
        const y0 = pad + Math.floor(i / N) * cell;
        for (const [dx, dy] of [
          [inset, inset],
          [cell - inset, inset],
          [inset, cell - inset],
          [cell - inset, cell - inset],
        ] as const) {
          b.beginPath();
          b.arc(x0 + dx, y0 + dy, 1.1, 0, Math.PI * 2);
          b.fill();
        }
      }
      backdrop = off;
    };

    const resize = () => {
      const box = canvas.parentElement;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      size = Math.floor(Math.min(rect.width, rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      pad = 14;
      cell = (size - 2 * pad) / N;
      buildBackdrop();
    };

    const tracePath = (dx = 0, dy = 0) => {
      ctx.beginPath();
      path.forEach((i, k) => {
        const [x, y] = center(i);
        if (k === 0) ctx.moveTo(x + dx, y + dy);
        else ctx.lineTo(x + dx, y + dy);
      });
      if (path.length === 1) {
        const [x, y] = center(path[0] ?? 0);
        ctx.lineTo(x + dx + 0.01, y + dy);
      }
    };

    const draw = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (backdrop) ctx.drawImage(backdrop, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = cell * 0.55;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (path.length > 0) {
        if (modeRef.current === 'full') {
          // soft shadow so the thread sits on the fabric
          ctx.strokeStyle = 'rgba(0,0,0,0.20)';
          ctx.lineWidth = w + 2;
          tracePath(0, 2);
          ctx.stroke();
        }
        ctx.strokeStyle = THREAD;
        ctx.lineWidth = w;
        tracePath();
        ctx.stroke();

        if (modeRef.current === 'full') {
          // satin stitch: short diagonal stitches across the band
          ctx.strokeStyle = 'rgba(120,20,10,0.28)';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          const half = w / 2 - 1.5;
          for (let k = 1; k < path.length; k++) {
            const [ax, ay] = center(path[k - 1] ?? 0);
            const [bx, by] = center(path[k] ?? 0);
            const ux = (bx - ax) / cell;
            const uy = (by - ay) / cell;
            const px = -uy;
            const py = ux;
            for (let s = 0; s < 6; s++) {
              const t = (s + 0.5) / 6;
              const mx = ax + (bx - ax) * t;
              const my = ay + (by - ay) * t;
              const lean = cell * 0.07;
              ctx.moveTo(mx - px * half - ux * lean, my - py * half - uy * lean);
              ctx.lineTo(mx + px * half + ux * lean, my + py * half + uy * lean);
            }
          }
          ctx.stroke();
          // 1px highlight
          ctx.strokeStyle = 'rgba(255,255,255,0.38)';
          ctx.lineWidth = 1;
          tracePath(-w * 0.22, -w * 0.22);
          ctx.stroke();
        }

        // stitch pop on freshly added cells (80 ms)
        for (let k = Math.max(0, path.length - 6); k < path.length; k++) {
          const i = path[k] ?? 0;
          const age = now - (addedAt[i] ?? 0);
          if (age < 80) {
            const [x, y] = center(i);
            ctx.fillStyle = THREAD;
            ctx.beginPath();
            ctx.arc(x, y, (w / 2) * (1 + 0.35 * (1 - age / 80)), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // buttons (drawn every frame, like the real board will)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(16, cell * 0.36)}px "Space Grotesk", system-ui, sans-serif`;
      BUTTON_CELLS.forEach((i, n) => {
        const [x, y] = center(i);
        const r = cell * 0.34;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.arc(x, y + 1.5, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if ((index[i] ?? -1) >= 0) {
          ctx.strokeStyle = THREAD;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - r * 0.45, y - r * 0.45);
          ctx.lineTo(x + r * 0.45, y + r * 0.45);
          ctx.moveTo(x + r * 0.45, y - r * 0.45);
          ctx.lineTo(x - r * 0.45, y + r * 0.45);
          ctx.stroke();
        }
        ctx.fillStyle = colors.ink;
        ctx.fillText(String(n + 1), x, y + 0.5);
      });

      // needle on the leading end
      if (path.length > 0) {
        const end = path[path.length - 1] ?? 0;
        const prev = path[path.length - 2];
        const [ex, ey] = center(end);
        let ux = 1;
        let uy = 0;
        if (prev !== undefined) {
          const [qx, qy] = center(prev);
          ux = (ex - qx) / cell;
          uy = (ey - qy) / cell;
        }
        ctx.strokeStyle = '#8D99A6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + ux * cell * 0.45, ey + uy * cell * 0.45);
        ctx.stroke();
      }
    };

    // --- path editing
    let agg: Record<Mode, Agg> = { full: emptyAgg(), simple: emptyAgg() };
    let cancels = 0;
    let scrolled = false;

    const push = (i: number, now: number) => {
      index[i] = path.length;
      path.push(i);
      addedAt[i] = now;
      agg[modeRef.current].cells += 1;
    };

    const cutTo = (k: number) => {
      for (let j = path.length - 1; j > k; j--) {
        const i = path[j];
        if (i !== undefined) index[i] = -1;
      }
      path.length = k + 1;
    };

    let retreating = false;
    const moveToward = (target: number, now: number) => {
      const end = path[path.length - 1];
      if (end === undefined) {
        push(target, now);
        return;
      }
      if (target === end) return;
      const at = index[target] ?? -1;
      if (at >= 0) {
        // one continuous retreat counts as one unpick
        if (!retreating) agg[modeRef.current].unpicks += 1;
        retreating = true;
        cutTo(at);
        return;
      }
      retreating = false;
      // fill skipped cells along the run, one legal step at a time
      let cur = end;
      for (let guard = 0; guard < 2 * N; guard++) {
        const dr = Math.floor(target / N) - Math.floor(cur / N);
        const dc = (target % N) - (cur % N);
        if (dr === 0 && dc === 0) break;
        const next =
          Math.abs(dc) >= Math.abs(dr) ? cur + Math.sign(dc) : cur + Math.sign(dr) * N;
        if ((index[next] ?? -1) >= 0) break;
        push(next, now);
        cur = next;
      }
    };

    const reset = () => {
      path = [];
      index.fill(-1);
    };
    resetRef.current = reset;

    // --- measurement
    let dragging = false;
    let lastFrame = 0;
    let pendingInput = 0; // timeStamp of the oldest pointer event not yet drawn
    let liveFrames: number[] = [];
    let raf = 0;

    const local = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const handle = (e: PointerEvent) => {
      const i = cellAt(...local(e));
      if (i >= 0) moveToward(i, performance.now());
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      dragging = true;
      retreating = false;
      liveFrames = [];
      agg[modeRef.current].drags += 1;
      const i = cellAt(...local(e));
      if (i < 0) return;
      const end = path[path.length - 1];
      if (path.length === 0 || (index[i] ?? -1) >= 0) {
        moveToward(i, performance.now());
      } else if (end !== undefined) {
        const adjacent =
          Math.abs(Math.floor(i / N) - Math.floor(end / N)) + Math.abs((i % N) - (end % N)) === 1;
        if (adjacent) moveToward(i, performance.now());
      }
      pendingInput = pendingInput || e.timeStamp;
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const a = agg[modeRef.current];
      a.events += 1;
      const batch = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      if (batch.length > 1) {
        a.coalesced += batch.length;
        batch.forEach(handle);
      } else {
        handle(e);
      }
      pendingInput = pendingInput || e.timeStamp;
    };

    const finish = () => {
      if (!dragging) return;
      dragging = false;
      agg[modeRef.current].frames.push(...liveFrames);
      void report('drag', 'info', evidenceRef.current());
    };

    const onUp = () => finish();
    const onCancel = () => {
      cancels += 1;
      finish();
    };
    const onScroll = () => {
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) scrolled = true;
    };

    evidenceRef.current = () => ({
      full: summarise(agg.full),
      simple: summarise(agg.simple),
      pointerCancels: cancels,
      webviewScrolled: scrolled,
      dpr,
      canvasCssPx: size,
      cellCssPx: +cell.toFixed(1),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });

    let hudAt = 0;
    const frame = (t: number) => {
      const dt = lastFrame ? t - lastFrame : 0;
      lastFrame = t;
      if (dragging && dt > 0) {
        liveFrames.push(dt);
        if (pendingInput) {
          agg[modeRef.current].inputDelay.push(Math.max(0, t - pendingInput));
        }
      }
      pendingInput = 0;
      draw(t);
      if (t - hudAt > 250) {
        hudAt = t;
        const s = summarise({
          ...agg[modeRef.current],
          frames: dragging ? liveFrames : agg[modeRef.current].frames,
        });
        hud.textContent =
          `${modeRef.current} · ${s.avgFps} fps avg (screen ${s.refreshHz} Hz) · ` +
          `p95 ${s.p95FrameMs} ms · worst ${s.worstFrameMs} ms · slow frames ${s.longFramePct}% · ` +
          `touch→frame ${s.inputToFrameAvgMs} ms · cancels ${cancels} · ` +
          `scrolled ${scrolled ? 'YES' : 'no'} · cell ${cell.toFixed(0)} px`;
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    raf = requestAnimationFrame(frame);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      agg = { full: emptyAgg(), simple: emptyAgg() };
    };
  }, []);

  const choose = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };

  const judge = (outcome: 'pass' | 'fail', label: string) => {
    setVerdict(label);
    void report('drag', outcome, { verdict: label, ...Object(evidenceRef.current()) });
  };

  return (
    <div className="drag">
      <div className="drag-bar">
        <div className="seg">
          <button className={mode === 'full' ? 'on' : ''} onClick={() => choose('full')}>
            Full stitches
          </button>
          <button className={mode === 'simple' ? 'on' : ''} onClick={() => choose('simple')}>
            Simple line
          </button>
        </div>
        <button onClick={() => resetRef.current()}>Reset</button>
      </div>
      <div className="drag-stage">
        <canvas ref={canvasRef} className="board" />
      </div>
      <div ref={hudRef} className="hud">
        Drag on the board…
      </div>
      <div className="verdict">
        <button
          className={verdict === 'smooth' ? 'on good' : 'good'}
          onClick={() => judge('pass', 'smooth')}
        >
          Smooth, page stayed still
        </button>
        <button className={verdict === 'laggy' ? 'on bad' : 'bad'} onClick={() => judge('fail', 'laggy')}>
          Laggy
        </button>
        <button
          className={verdict === 'page-moved' ? 'on bad' : 'bad'}
          onClick={() => judge('fail', 'page-moved')}
        >
          Page moved
        </button>
      </div>
    </div>
  );
};

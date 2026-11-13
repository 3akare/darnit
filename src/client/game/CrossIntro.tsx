// Shown once, over the first board with a cross-stitch square: a 3-second loop of the
// thread passing straight down through the square, then straight across it. Tap anywhere
// to close.

import { useEffect, useRef } from 'react';
import { drawWool } from './draw.ts';

const SIZE = 180;

export const CrossIntro = ({ onClose }: { onClose: () => void }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cell = SIZE / 3;
    const c = (col: number, row: number): [number, number] => [(col + 0.5) * cell, (row + 0.5) * cell];
    let raf = 0;

    const partial = (from: [number, number], to: [number, number], t: number): [number, number][] => [
      from,
      [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
    ];

    const frame = (now: number) => {
      const t = reduced ? 2.9 : (now / 1000) % 3;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      // Pencil grid and the marked square.
      ctx.strokeStyle = 'rgba(78, 84, 96, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        ctx.moveTo(i * cell + 0.5, 0);
        ctx.lineTo(i * cell + 0.5, SIZE);
        ctx.moveTo(0, i * cell + 0.5);
        ctx.lineTo(SIZE, i * cell + 0.5);
      }
      ctx.stroke();
      const [mx, my] = c(1, 1);
      ctx.strokeStyle = 'rgba(50, 54, 62, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx - cell * 0.27, my - cell * 0.27);
      ctx.lineTo(mx + cell * 0.27, my + cell * 0.27);
      ctx.moveTo(mx + cell * 0.27, my - cell * 0.27);
      ctx.lineTo(mx - cell * 0.27, my + cell * 0.27);
      ctx.stroke();

      const w = cell * 0.34;
      // First pass: straight down. Second pass: straight across, over the first.
      const down = Math.min(1, t / 1.1);
      drawWool(ctx, partial([mx, 0], [mx, SIZE], down), w, 11);
      if (t > 1.3) drawWool(ctx, partial([0, my], [SIZE, my], Math.min(1, (t - 1.3) / 1.1)), w, 23);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="intro" role="dialog" aria-label="Cross-stitch squares" onClick={onClose}>
      <div className="intro-card">
        <canvas ref={ref} style={{ width: SIZE, height: SIZE }} />
        <p>
          <strong>Squares marked X take the thread twice:</strong> once across and once up and down, straight through both
          times.
        </p>
        <p className="fine">Tap anywhere to start.</p>
      </div>
    </div>
  );
};

// The sketchbook's wire binding along the top of the page: punched holes, and a steel coil
// that comes up out of each hole, over the top edge and round behind the page.

import { useEffect, useRef } from 'react';

const HEIGHT = 34;
const PITCH = 22;

export const Spiral = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      const width = Math.round(canvas.getBoundingClientRect().width);
      if (width <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);

      const edge = 11; // the page's top edge
      // Behind the page: the shadowed board of the sketchbook cover.
      const back = ctx.createLinearGradient(0, 0, 0, edge);
      back.addColorStop(0, '#D9D4CB');
      back.addColorStop(1, '#C9C3B8');
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, width, edge);
      // The page edge casts a soft line.
      const lip = ctx.createLinearGradient(0, edge, 0, edge + 6);
      lip.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
      lip.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lip;
      ctx.fillRect(0, edge, width, 6);

      const count = Math.floor((width - 12) / PITCH);
      const start = (width - (count - 1) * PITCH) / 2;
      const holeY = edge + 12;
      for (let i = 0; i < count; i++) {
        const x = start + i * PITCH;
        // Punched hole with the paper's cut edge catching light below it.
        ctx.fillStyle = '#C9C3B8';
        ctx.beginPath();
        ctx.roundRect(x - 3.6, holeY - 4, 7.2, 8, 3.6);
        ctx.fill();
        ctx.fillStyle = 'rgba(40, 36, 32, 0.35)';
        ctx.beginPath();
        ctx.roundRect(x - 3.6, holeY - 4, 7.2, 3.2, [3.6, 3.6, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - 4.2, holeY - 4.4, 8.4, 9, 4);
        ctx.stroke();
      }

      // The coil: one loop per hole, drawn as a round steel wire in layers.
      const loop = (dx: number, dy: number, path: (c: CanvasRenderingContext2D) => void) => {
        ctx.save();
        ctx.translate(dx, dy);
        path(ctx);
        ctx.restore();
      };
      // A ring: up out of the hole, round over the top, and down behind the page edge.
      const ring = 5;
      const wire = (x: number) => (c: CanvasRenderingContext2D) => {
        c.beginPath();
        c.moveTo(x - 0.4, holeY + 1);
        c.lineTo(x - 0.8, ring + 2);
        c.arc(x - 0.8 + ring, ring + 2, ring, Math.PI, 0);
        c.lineTo(x - 0.8 + ring * 2, edge + 1);
      };
      for (let i = 0; i < count; i++) {
        const x = start + i * PITCH;
        // Shadow of the wire on the page.
        loop(1.2, 2.2, wire(x));
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Dark core, steel body, bright specular line.
        for (const [style, w, ox, oy] of [
          ['#3A3F46', 3.6, 0, 0],
          ['#8C949E', 2.7, 0, 0],
          ['#C9CFD6', 1.6, -0.35, -0.35],
          ['rgba(255, 255, 255, 0.95)', 0.7, -0.6, -0.6],
        ] as const) {
          loop(ox, oy, wire(x));
          ctx.strokeStyle = style;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return <canvas ref={ref} className="spiral" aria-hidden="true" />;
};

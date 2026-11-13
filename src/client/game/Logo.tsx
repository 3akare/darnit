// The DarnIt! logo, embroidered into the page: each letter a satin-stitch fill in its own
// colour, with a split-stitch outline, a raised shadow and the paper lifting round it.

import { useEffect, useRef } from 'react';

const LETTERS = ['D', 'a', 'r', 'n', 'I', 't', '!'];
const COLOURS = ['#E11D48', '#F59E0B', '#16A34A', '#0891B2', '#2F5BEA', '#C026D3', '#EA580C'];

/** Mix a colour toward black (f < 0) or white (f > 0). */
const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

/**
 * The capital I as an I-beam with serif bars, drawn as a path. In a plain sans it looks like
 * a lowercase l, and the name would read "Darnlt".
 */
const iBeam = (x: number, baseline: number, cap: number, stem: number): Path2D => {
  const bar = stem * 0.85;
  const half = stem * 1.45;
  const mid = x + half;
  const top = baseline - cap;
  const p = new Path2D();
  p.moveTo(x, top);
  p.lineTo(x + half * 2, top);
  p.lineTo(x + half * 2, top + bar);
  p.lineTo(mid + stem / 2, top + bar);
  p.lineTo(mid + stem / 2, baseline - bar);
  p.lineTo(x + half * 2, baseline - bar);
  p.lineTo(x + half * 2, baseline);
  p.lineTo(x, baseline);
  p.lineTo(x, baseline - bar);
  p.lineTo(mid - stem / 2, baseline - bar);
  p.lineTo(mid - stem / 2, top + bar);
  p.lineTo(x, top + bar);
  p.closePath();
  return p;
};

export const Logo = ({ height }: { height: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const fontPx = Math.round(height * 0.86);
      const font = `700 ${fontPx}px "Space Grotesk", system-ui, sans-serif`;
      ctx.font = font;
      const iMetrics = ctx.measureText('I');
      const cap = iMetrics.actualBoundingBoxAscent || fontPx * 0.7;
      const stem = Math.max(2, (iMetrics.actualBoundingBoxRight + iMetrics.actualBoundingBoxLeft) || fontPx * 0.14);
      const widths = LETTERS.map((ch) => (ch === 'I' ? stem * 2.9 : ctx.measureText(ch).width));
      const gap = fontPx * 0.03;
      const padX = fontPx * 0.1;
      const width = Math.ceil(widths.reduce((a, b) => a + b, 0) + gap * (LETTERS.length - 1) + padX * 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const baseline = height * 0.8;
      const xs: number[] = [];
      let x = padX;
      for (const w of widths) {
        xs.push(x);
        x += w + gap;
      }
      /** Fill or stroke one letter: text for most, a path for the I. */
      const paint = (target: CanvasRenderingContext2D, i: number, mode: 'fill' | 'stroke', dx = 0, dy = 0) => {
        const ch = LETTERS[i] ?? '';
        const lx = (xs[i] ?? 0) + dx;
        if (ch === 'I') {
          const path = iBeam(lx, baseline + dy, cap, stem);
          if (mode === 'fill') target.fill(path);
          else target.stroke(path);
        } else if (mode === 'fill') {
          target.fillText(ch, lx, baseline + dy);
        } else {
          target.strokeText(ch, lx, baseline + dy);
        }
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = font;
      ctx.lineJoin = 'round';

      // The paper lifts slightly round the stitching.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)';
      ctx.lineWidth = fontPx * 0.11;
      LETTERS.forEach((_, i) => paint(ctx, i, 'stroke', 0.8, 1.2));
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
      ctx.lineWidth = fontPx * 0.09;
      LETTERS.forEach((_, i) => paint(ctx, i, 'stroke', -0.6, -0.8));

      // Satin fill, one letter at a time on a scratch canvas, masked to the glyph.
      const scratch = document.createElement('canvas');
      scratch.width = canvas.width;
      scratch.height = canvas.height;
      const s = scratch.getContext('2d');
      if (!s) return;
      LETTERS.forEach((_, i) => {
        const colour = COLOURS[i] ?? '#E11D48';
        const lx = xs[i] ?? 0;
        const lw = widths[i] ?? 0;
        s.setTransform(1, 0, 0, 1, 0, 0);
        s.globalCompositeOperation = 'source-over';
        s.clearRect(0, 0, scratch.width, scratch.height);
        s.setTransform(dpr, 0, 0, dpr, 0, 0);
        s.fillStyle = colour;
        s.fillRect(lx - 4, 0, lw + 8, height);

        s.save();
        s.translate(lx + lw / 2, height / 2);
        s.rotate(i % 2 ? -0.7 : 0.7);
        const span = height * 1.4;
        for (let k = -span; k < span; k += 1.7) {
          s.strokeStyle = shade(colour, -0.32);
          s.globalAlpha = 0.55;
          s.lineWidth = 0.55;
          s.beginPath();
          s.moveTo(-span, k);
          s.lineTo(span, k);
          s.stroke();
          s.strokeStyle = shade(colour, 0.35);
          s.globalAlpha = 0.5;
          s.lineWidth = 0.5;
          s.beginPath();
          s.moveTo(-span, k + 0.85);
          s.lineTo(span, k + 0.85);
          s.stroke();
        }
        s.restore();
        s.globalAlpha = 1;
        const sheen = s.createLinearGradient(lx, 0, lx + lw, height);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        sheen.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        s.fillStyle = sheen;
        s.fillRect(lx - 4, 0, lw + 8, height);

        s.globalCompositeOperation = 'destination-in';
        s.font = font;
        s.fillStyle = '#000';
        paint(s, i, 'fill');

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.shadowColor = 'rgba(40, 16, 16, 0.38)';
        ctx.shadowBlur = 2.5 * dpr;
        ctx.shadowOffsetX = 0.6 * dpr;
        ctx.shadowOffsetY = 1.8 * dpr;
        ctx.drawImage(scratch, 0, 0);
        ctx.restore();

        // Split-stitch outline in a deeper shade.
        ctx.save();
        ctx.font = font;
        ctx.strokeStyle = shade(colour, -0.45);
        ctx.lineWidth = Math.max(1.3, fontPx * 0.042);
        ctx.lineCap = 'round';
        ctx.setLineDash([fontPx * 0.075, fontPx * 0.03]);
        paint(ctx, i, 'stroke');
        ctx.restore();
      });
    };

    draw();
    void document.fonts.load(`700 ${Math.round(height * 0.86)}px "Space Grotesk"`).then(draw, () => undefined);
    return () => {
      alive = false;
    };
  }, [height]);

  return <canvas ref={ref} className="logo" role="img" aria-label="DarnIt!" />;
};

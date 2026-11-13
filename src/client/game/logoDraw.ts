// The DarnIt! logo as embroidered varsity lettering, like a college hoodie: heavy slab
// capitals set on a gentle arch, each letter in its own colour, with a cream twill outline
// and a dark stitched edge, all in satin stitch and raised off the page.


const LETTERS = ['D', 'A', 'R', 'N', 'I', 'T', '!'];
const COLOURS = [
  '#FF1744',
  '#FFB300',
  '#00C853',
  '#00B0FF',
  '#2962FF',
  '#E91EC4',
  '#FF6D00',
];
const FONT_FAMILY = '"Alfa Slab One", Georgia, serif';
const TWILL = '#FFFFFF';
const EDGE = '#1C1B20';

/** Mix a colour toward black (f < 0) or white (f > 0). */
const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

/** A small tile of satin stitches in one colour, for use as a fill pattern. */
const satin = (
  ctx: CanvasRenderingContext2D,
  colour: string,
  dpr: number
): CanvasPattern | string => {
  const t = Math.max(2, Math.round(1.6 * dpr)) * 2;
  const tile = document.createElement('canvas');
  tile.width = t;
  tile.height = t;
  const g = tile.getContext('2d');
  if (!g) return colour;
  g.fillStyle = colour;
  g.fillRect(0, 0, t, t);
  const step = t / 2;
  g.lineWidth = Math.max(1, dpr * 0.45);
  for (let k = -t; k <= 2 * t; k += step) {
    g.strokeStyle = shade(colour, -0.1);
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k - t, t);
    g.stroke();
    g.strokeStyle = shade(colour, 0.35);
    g.beginPath();
    g.moveTo(k + step / 2, 0);
    g.lineTo(k + step / 2 - t, t);
    g.stroke();
  }
  return ctx.createPattern(tile, 'repeat') ?? colour;
};

/**
 * Draw the logo into a canvas, sized to fit `height` CSS pixels at the given pixel ratio.
 * Also used to make the subreddit icon and banners.
 */
export const drawLogo = (
  canvas: HTMLCanvasElement,
  height: number,
  dpr: number
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const fontPx = Math.round(height * 0.62);
  const font = `400 ${fontPx}px ${FONT_FAMILY}`;
  const edgeW = fontPx * 0.26;
  const twillW = fontPx * 0.17;
  ctx.font = font;
  const widths = LETTERS.map((ch) => ctx.measureText(ch).width);
  const track = fontPx * 0.11;
  const run = widths.reduce((a, b) => a + b, 0) + track * (LETTERS.length - 1);
  const width = Math.ceil(run + edgeW * 2);

  // Set the letters on an arch: a circle well below the logo.
  const radius = run * 2.1;
  const cx = width / 2;
  const capTop = height * 0.08 + edgeW / 2;
  const cy = capTop + radius;
  const placed: { ch: string; angle: number; w: number; colour: string }[] = [];
  let along = -run / 2;
  LETTERS.forEach((ch, i) => {
    const w = widths[i] ?? 0;
    placed.push({
      ch,
      angle: (along + w / 2) / radius,
      w,
      colour: COLOURS[i] ?? '#D7263D',
    });
    along += w + track;
  });

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const comp = document.createElement('canvas');
  comp.width = canvas.width;
  comp.height = canvas.height;
  const c = comp.getContext('2d');
  if (!c) return;
  c.font = font;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';

  const each = (fn: (p: (typeof placed)[number]) => void) => {
    for (const p of placed) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(cx, cy);
      c.rotate(p.angle);
      c.translate(0, -radius + fontPx * 0.72);
      fn(p);
    }
  };

  // Dark stitched edge, then the cream twill outline, under every letter.
  c.strokeStyle = EDGE;
  c.lineWidth = edgeW;
  each((p) => c.strokeText(p.ch, 0, 0));
  c.strokeStyle = satin(c, TWILL, dpr);
  c.lineWidth = twillW;
  each((p) => c.strokeText(p.ch, 0, 0));

  // Each letter in its own colour, in satin stitch, with a fine darker edge.
  each((p) => {
    c.fillStyle = satin(c, p.colour, dpr);
    c.fillText(p.ch, 0, 0);
    c.strokeStyle = shade(p.colour, -0.3);
    c.lineWidth = Math.max(1, fontPx * 0.022);
    c.strokeText(p.ch, 0, 0);
  });

  // Light falls from the top left across the raised stitching.
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  const sheen = c.createLinearGradient(0, 0, comp.width * 0.4, comp.height);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
  c.fillStyle = sheen;
  c.fillRect(0, 0, comp.width, comp.height);
  c.globalCompositeOperation = 'source-over';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.shadowColor = 'rgba(30, 20, 20, 0.4)';
  ctx.shadowBlur = 3 * dpr;
  ctx.shadowOffsetX = 0.8 * dpr;
  ctx.shadowOffsetY = 2.2 * dpr;
  ctx.drawImage(comp, 0, 0);
  ctx.restore();
};

// The page: white sketchbook paper with a fine grain, a few fibres and specks. Drawn once
// in code and used as the page background.

import { seeded } from '../shared/puzzle/rng.ts';

/** One 512 px tile of paper, seamless, for use as a repeating pattern. */
export const paperTile = (): HTMLCanvasElement => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const rnd = seeded(1977);

  // Grain, plus a gentle mottling that tiles seamlessly.
  const grid = 8;
  const mottle = Array.from({ length: grid * grid }, () => (rnd() - 0.5) * 5);
  const at = (gx: number, gy: number): number => mottle[(((gy % grid) + grid) % grid) * grid + (((gx % grid) + grid) % grid)] ?? 0;
  const image = ctx.createImageData(size, size);
  const d = image.data;
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * grid;
    const gy = Math.floor(fy);
    const ty = fy - gy;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * grid;
      const gx = Math.floor(fx);
      const tx = fx - gx;
      const low =
        at(gx, gy) * (1 - tx) * (1 - ty) + at(gx + 1, gy) * tx * (1 - ty) + at(gx, gy + 1) * (1 - tx) * ty + at(gx + 1, gy + 1) * tx * ty;
      const v = 251 + low + (rnd() - 0.5) * 7;
      const i = (y * size + x) * 4;
      d[i] = v;
      d[i + 1] = v - 0.6;
      d[i + 2] = v - 3;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI * 2;
    const len = 5 + rnd() * 22;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(120, 124, 140, 0.07)' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.5, y + Math.sin(a + 0.5) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(80, 80, 90, ${0.08 + rnd() * 0.14})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 0.4 + rnd() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
};

const paperTexture = (): string => paperTile().toDataURL('image/png');

export const applyPaper = (): void => {
  try {
    const url = paperTexture();
    if (url) document.documentElement.style.setProperty('--paper', `url("${url}")`);
  } catch {
    // Without the texture the page is plain white, which still works.
  }
};

// The DarnIt! logo on the page; the drawing itself is in logoDraw.ts.

import { useEffect, useRef } from 'react';
import { drawLogo } from './logoDraw.ts';

export const Logo = ({ height }: { height: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;

    const draw = () => {
      if (alive)
        drawLogo(canvas, height, Math.min(window.devicePixelRatio || 1, 3));
    };

    draw();
    void document.fonts
      .load(`400 ${Math.round(height * 0.62)}px "Alfa Slab One"`, 'DARNIT!')
      .then(draw, () => undefined);
    return () => {
      alive = false;
    };
  }, [height]);

  return <canvas ref={ref} className="logo" role="img" aria-label="DarnIt!" />;
};

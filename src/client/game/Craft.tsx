// Small hand-made pieces: the spiral binding, difficulty needles and stitched icons.

import { useId } from 'react';

/** Sketchbook spiral binding along the top of the page. */
export const Spiral = () => {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="spiral" aria-hidden="true" width="100%" height="30">
      <defs>
        <linearGradient id={`${id}w`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7F8790" />
          <stop offset="0.45" stopColor="#F3F5F7" />
          <stop offset="1" stopColor="#6C747D" />
        </linearGradient>
        <pattern id={`${id}p`} width="26" height="30" patternUnits="userSpaceOnUse">
          <ellipse cx="13" cy="23" rx="4.4" ry="3.6" fill="#1E1D22" />
          <ellipse cx="13" cy="24.6" rx="4.4" ry="2" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
          <path d="M11 23 C 10.5 13, 15 6, 16.5 -1" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="4" strokeLinecap="round" transform="translate(1.2 1.6)" />
          <path d="M11 23 C 10.5 13, 15 6, 16.5 -1" fill="none" stroke={`url(#${id}w)`} strokeWidth="3.2" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="30" fill={`url(#${id}p)`} />
    </svg>
  );
};

/** One to three sewing needles: the pattern's difficulty. */
export const Needles = ({ count, label }: { count: number; label: string }) => (
  <span className="needles" role="img" aria-label={label}>
    {Array.from({ length: count }, (_, i) => (
      <svg key={i} width="11" height="30" viewBox="0 0 11 30" aria-hidden="true">
        <path d="M5.5 29 L3.6 8 Q3.4 1.5 5.5 1.2 Q7.6 1.5 7.4 8 Z" fill="#1A191E" />
        <ellipse cx="5.5" cy="5.6" rx="0.9" ry="2.4" fill="#FFFFFF" />
      </svg>
    ))}
  </span>
);

const ICONS = {
  undo: 'M8.5 5.5 L4 10 L8.5 14.5 M4.5 10 H14.5 A5 5 0 0 1 14.5 20 H10',
  hint: 'M9 18 H15 M10 21 H14 M12 3 A6 6 0 0 0 8.2 13.6 C9 14.4 9.3 15 9.3 16 H14.7 C14.7 15 15 14.4 15.8 13.6 A6 6 0 0 0 12 3 Z',
  reset: 'M19.5 12 A7.5 7.5 0 1 1 17.3 6.7 M19.5 3.5 V8.5 H14.5',
  copy: 'M8 8 H18 V20 H8 Z M5 16 V4 H15',
  share: 'M12 15 V3 M7.5 7.5 L12 3 L16.5 7.5 M5 12 V20 H19 V12',
};

/** Icons drawn as running stitches: short dashes along each line. */
export const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg className="icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={ICONS[name]}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="3.2 2.2"
    />
  </svg>
);

// Small hand-made pieces: the difficulty label and stitched icons.

import type { Difficulty } from '../../shared/puzzle/pattern.ts';

/** The pattern's difficulty, as a word. */
export const Level = ({ difficulty }: { difficulty: Difficulty }) => (
  <span className={`level ${difficulty}`}>{difficulty[0]?.toUpperCase() + difficulty.slice(1)}</span>
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

// The 4x4 practice pattern for a first-ever play: a snake that teaches button order and
// filling every square. Hand-picked; the test proves it has exactly one solution.

import type { StoredPattern } from './pattern.ts';

export const PRACTICE: StoredPattern = {
  id: 'practice',
  size: 4,
  buttons: [0, 3, 4, 14],
  seams: [],
  crosses: [],
  difficulty: 'easy',
  solution: [0, 1, 2, 3, 7, 6, 5, 4, 8, 12, 13, 9, 10, 11, 15, 14],
  score: 0,
};

/** The square to point at next: the next correct step, or the last good square to unpick back to. */
export const guideCell = (thread: readonly number[], solution: readonly number[]): { cell: number; back: boolean } => {
  let good = 0;
  while (good < thread.length && thread[good] === solution[good]) good += 1;
  if (good < thread.length) return { cell: solution[good - 1] ?? solution[0] ?? 0, back: true };
  return { cell: solution[good] ?? -1, back: false };
};

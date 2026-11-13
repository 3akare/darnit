// How the thread responds to a finger. Pure functions, so the feel of drawing is testable.
//
// While dragging, the thread only unpicks one cell at a time, and only when the finger moves
// back onto the cell just behind the head. Touching any other part of the thread does
// nothing. Cutting back to an earlier cell takes a deliberate tap on it.

import { stepProblem } from './pattern.ts';
import type { Board } from './pattern.ts';

export type Stitch = {
  thread: number[];
  /** Cells added by this gesture. */
  added: number;
  /** Cells removed by this gesture. */
  removed: number;
};

const cellBefore = (thread: readonly number[]): number | undefined => thread[thread.length - 2];

/** One step of the head onto a neighbouring cell: extend, unpick one, or nothing. */
const stepOnto = (board: Board, thread: number[], next: number): 'added' | 'removed' | 'blocked' => {
  if (thread.length >= 2 && next === cellBefore(thread)) {
    thread.pop();
    return 'removed';
  }
  if (stepProblem(board, thread, next) === null) {
    thread.push(next);
    return 'added';
  }
  return 'blocked';
};

/**
 * Drag the head toward `target`. A fast swipe can skip cells, so this walks one cell at a
 * time and stops at the first step that is not legal.
 */
export const dragTo = (board: Board, current: readonly number[], target: number): Stitch => {
  const thread = [...current];
  let added = 0;
  let removed = 0;
  const { size } = board;
  for (let guard = 0; guard < size * 4; guard++) {
    const head = thread[thread.length - 1];
    if (head === undefined || head === target) break;
    const dRow = Math.floor(target / size) - Math.floor(head / size);
    const dCol = (target % size) - (head % size);
    const alongRow = head + Math.sign(dCol);
    const alongCol = head + Math.sign(dRow) * size;
    // Try the longer leg first, then the other one.
    const tries =
      dRow === 0 ? [alongRow] : dCol === 0 ? [alongCol] : Math.abs(dCol) >= Math.abs(dRow) ? [alongRow, alongCol] : [alongCol, alongRow];
    // On a diagonal move, prefer the leg that adds a stitch over the one that unpicks:
    // a gesture that could be read either way should never destroy work.
    const back = cellBefore(thread);
    tries.sort((a, b) => Number(a === back) - Number(b === back));
    let moved = false;
    for (const next of tries) {
      const outcome = stepOnto(board, thread, next);
      if (outcome === 'blocked') continue;
      if (outcome === 'added') added += 1;
      else removed += 1;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return { thread, added, removed };
};

/** Undo: remove the last cell. Button 1 always stays. */
export const undoStitch = (current: readonly number[]): Stitch => {
  if (current.length <= 1) return { thread: [...current], added: 0, removed: 0 };
  return { thread: current.slice(0, -1), added: 0, removed: 1 };
};

/** A deliberate tap on an earlier thread cell cuts the thread back to it. */
export const cutTo = (current: readonly number[], cell: number): Stitch => {
  const at = current.lastIndexOf(cell);
  if (at < 0 || at === current.length - 1) return { thread: [...current], added: 0, removed: 0 };
  return { thread: current.slice(0, at + 1), added: 0, removed: current.length - 1 - at };
};

/** Reset: back to just button 1. */
export const resetThread = (board: Board, current: readonly number[]): Stitch => ({
  thread: [board.buttons[0] ?? 0],
  added: 0,
  removed: Math.max(0, current.length - 1),
});

/**
 * Counts unpicks the way the SPEC does: one continuous retreat is one unpick, however many
 * cells it removes. Any new stitch ends the retreat.
 */
export const createUnpickCounter = () => {
  let count = 0;
  let retreating = false;
  return {
    note(stitch: Stitch): void {
      if (stitch.removed > 0 && !retreating) {
        count += 1;
        retreating = true;
      }
      if (stitch.added > 0) retreating = false;
    },
    get count(): number {
      return count;
    },
    reset(): void {
      count = 0;
      retreating = false;
    },
  };
};

// A Pattern is one day's puzzle. This file holds its shape, the fabric geometry, and the
// rules for a single step of the thread. Client, server, solver and generator all use it,
// so the rules live in exactly one place.

export type Difficulty = 'easy' | 'medium' | 'hard';

/** What the player is given. Never includes the solution. */
export type Pattern = {
  id: string;
  /** The fabric is size x size cells, numbered row by row from the top left. */
  size: number;
  /** Cells holding buttons, in number order. The first is the start, the last is the end. */
  buttons: number[];
  /** Seams as edge ids: cell * 2 is the seam on a cell's right side, cell * 2 + 1 the seam below it. */
  seams: number[];
  /** Cross-stitch cells: the thread passes each twice, once across and once down. */
  crosses: number[];
  difficulty: Difficulty;
};

/** A bank entry. Server only: the solution powers hints, the heatmap and the race replay. */
export type StoredPattern = Pattern & {
  /** Every cell of the thread in order. Cross-stitch cells appear twice. */
  solution: number[];
  /** Difficulty score from the solver. Higher is harder. */
  score: number;
};

export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;

/** A Pattern compiled into flat arrays for fast lookups. */
export type Board = {
  size: number;
  /** Number of cells. */
  count: number;
  isCross: Uint8Array;
  /** Button number order (0-based) at each cell, or -1. */
  buttonIndex: Int8Array;
  buttons: number[];
  /** open[cell * 4 + direction] is 1 when that move stays on the fabric and crosses no seam. */
  open: Uint8Array;
  /** Offset to add to a cell index for each direction. */
  delta: number[];
  /** Thread length when the pattern is solved: every cell once, cross-stitch cells twice. */
  total: number;
};

export const seamRight = (cell: number): number => cell * 2;
export const seamBelow = (cell: number): number => cell * 2 + 1;

/** The seam id between two side-by-side cells, or -1 if they are not neighbours. */
export const seamBetween = (size: number, a: number, b: number): number => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo === 1 && Math.floor(lo / size) === Math.floor(hi / size)) return seamRight(lo);
  if (hi - lo === size) return seamBelow(lo);
  return -1;
};

export const compile = (pattern: Pick<Pattern, 'size' | 'buttons' | 'seams' | 'crosses'>): Board => {
  const { size } = pattern;
  const count = size * size;
  const isCross = new Uint8Array(count);
  for (const c of pattern.crosses) isCross[c] = 1;
  const buttonIndex = new Int8Array(count).fill(-1);
  pattern.buttons.forEach((cell, i) => {
    buttonIndex[cell] = i;
  });
  const seams = new Set(pattern.seams);
  const open = new Uint8Array(count * 4);
  for (let cell = 0; cell < count; cell++) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    if (row > 0 && !seams.has(seamBelow(cell - size))) open[cell * 4 + UP] = 1;
    if (col < size - 1 && !seams.has(seamRight(cell))) open[cell * 4 + RIGHT] = 1;
    if (row < size - 1 && !seams.has(seamBelow(cell))) open[cell * 4 + DOWN] = 1;
    if (col > 0 && !seams.has(seamRight(cell - 1))) open[cell * 4 + LEFT] = 1;
  }
  return {
    size,
    count,
    isCross,
    buttonIndex,
    buttons: [...pattern.buttons],
    open,
    delta: [-size, 1, size, -1],
    total: count + pattern.crosses.length,
  };
};

/** Direction of the move from a to b, or -1 if they are not neighbours on the fabric. */
export const directionBetween = (board: Board, a: number, b: number): number => {
  for (let dir = 0; dir < 4; dir++) {
    if (a + (board.delta[dir] ?? 0) === b) {
      // Guard against wrapping from the end of one row to the start of the next.
      if ((dir === RIGHT || dir === LEFT) && Math.floor(a / board.size) !== Math.floor(b / board.size)) {
        return -1;
      }
      return dir;
    }
  }
  return -1;
};

const isHorizontal = (dir: number): boolean => dir === RIGHT || dir === LEFT;

export type StepProblem =
  | 'not-adjacent'
  | 'seam'
  | 'must-go-straight'
  | 'cross-used'
  | 'occupied'
  | 'button-order';

/**
 * Why the thread cannot step onto `next`, or null if the step is legal.
 * `thread` is the thread so far and must not be empty.
 */
export const stepProblem = (board: Board, thread: readonly number[], next: number): StepProblem | null => {
  const head = thread[thread.length - 1];
  if (head === undefined) return 'not-adjacent';
  const dir = directionBetween(board, head, next);
  if (dir < 0) return 'not-adjacent';
  if (!board.open[head * 4 + dir]) return 'seam';

  // Leaving a cross-stitch cell: the thread must carry straight on.
  if (board.isCross[head]) {
    const before = thread[thread.length - 2];
    if (before !== undefined && directionBetween(board, before, head) !== dir) {
      return 'must-go-straight';
    }
  }

  if (board.isCross[next]) {
    // A cross-stitch cell takes one pass across and one pass down.
    for (let i = 0; i < thread.length; i++) {
      if (thread[i] !== next) continue;
      const from = thread[i - 1];
      if (from === undefined) return 'cross-used';
      if (isHorizontal(directionBetween(board, from, next)) === isHorizontal(dir)) return 'cross-used';
    }
    return null;
  }

  if (thread.includes(next)) return 'occupied';

  const button = board.buttonIndex[next] ?? -1;
  if (button >= 0) {
    let reached = 0;
    for (const cell of thread) if ((board.buttonIndex[cell] ?? -1) >= 0) reached += 1;
    if (button !== reached) return 'button-order';
  }
  return null;
};

export type ThreadVerdict = { ok: true } | { ok: false; reason: string; at: number };

/** Full check of a finished thread. This is what the server runs on every submission. */
export const checkThread = (board: Board, thread: readonly number[]): ThreadVerdict => {
  if (thread.length === 0) return { ok: false, reason: 'empty', at: 0 };
  if (thread[0] !== board.buttons[0]) return { ok: false, reason: 'must-start-on-button-1', at: 0 };
  for (let i = 1; i < thread.length; i++) {
    const cell = thread[i];
    if (cell === undefined || !Number.isInteger(cell) || cell < 0 || cell >= board.count) {
      return { ok: false, reason: 'off-fabric', at: i };
    }
    const problem = stepProblem(board, thread.slice(0, i), cell);
    if (problem) return { ok: false, reason: problem, at: i };
  }
  if (thread.length !== board.total) return { ok: false, reason: 'unfilled-cells', at: thread.length };
  if (thread[thread.length - 1] !== board.buttons[board.buttons.length - 1]) {
    return { ok: false, reason: 'must-end-on-last-button', at: thread.length - 1 };
  }
  return { ok: true };
};

/** True when the thread fills the fabric and ends on the last button. Assumes every step was legal. */
export const isComplete = (board: Board, thread: readonly number[]): boolean =>
  thread.length === board.total && thread[thread.length - 1] === board.buttons[board.buttons.length - 1];

/** Strip the server-only fields before a pattern goes to the client. */
export const toPublic = (stored: StoredPattern): Pattern => ({
  id: stored.id,
  size: stored.size,
  buttons: stored.buttons,
  seams: stored.seams,
  crosses: stored.crosses,
  difficulty: stored.difficulty,
});

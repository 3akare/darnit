// Depth-first solver. It proves a pattern has exactly one solution, finds a second solution
// when there is one (so the generator knows where to add a clue), builds random threads for
// the generator, and scores difficulty.

import { RIGHT, LEFT } from './pattern.ts';
import type { Board } from './pattern.ts';
import type { Rng } from './rng.ts';

export type SolveOptions = {
  /** Stop after this many solutions. 2 is enough to prove a pattern is not unique. */
  limit?: number;
  /** Give up after this many search steps. The result is then marked `capped`. */
  nodeCap?: number;
  /** The thread may end on any cell. Used when building a random thread. */
  freeEnd?: boolean;
  /** Try moves in random order. */
  rng?: Rng;
};

export type SolveResult = {
  solutions: number[][];
  /** Search steps taken. A measure of how hard the pattern was to settle. */
  nodes: number;
  /** True when the search hit `nodeCap` before finishing, so the answer is incomplete. */
  capped: boolean;
};

export type Analysis = {
  /** Share of moves along the solution where only one move survives a one-step look ahead. */
  forcedShare: number;
  /** Longest run of moves in a row where the player has a real choice. */
  longestFreeRun: number;
};

const axisBit = (dir: number): number => (dir === RIGHT || dir === LEFT ? 1 : 2);

/** Search state for one board. Kept in a closure so apply, undo and prune share the arrays. */
const createSearch = (board: Board, freeEnd: boolean) => {
  const { count, isCross, buttonIndex, buttons, open, delta } = board;
  const visited = new Uint8Array(count);
  /** Per cross-stitch cell: bit 1 = crossed sideways, bit 2 = crossed up-down. */
  const used = new Uint8Array(count);
  const path: number[] = [];
  const lastButton = buttons.length - 1;
  const endCell = freeEnd ? -1 : (buttons[lastButton] ?? -1);
  const start = buttons[0] ?? 0;
  let remaining = board.total - 1;
  /** Plain cells not yet on the thread. The start is already on it. */
  let unvisited = count - (board.total - count) - 1;
  let nextButton = 1;
  const seen = new Uint8Array(count);
  const stack = new Int32Array(count);

  visited[start] = 1;
  path.push(start);

  /** Where a move from `from` in `dir` lands after carrying straight through any cross-stitch cells. */
  const probe = (from: number, dir: number): number => {
    let c = from;
    const bit = axisBit(dir);
    for (;;) {
      if (!open[c * 4 + dir]) return -1;
      c += delta[dir] ?? 0;
      if (!isCross[c]) return c;
      if ((used[c] ?? 0) & bit) return -1;
    }
  };

  /** Number of cells the thread grows by for this move, or 0 if the move is illegal. */
  const tryMove = (dir: number): number => {
    const head = path[path.length - 1] ?? 0;
    const land = probe(head, dir);
    if (land < 0 || visited[land]) return 0;
    let steps = 0;
    let c = head;
    while (c !== land) {
      c += delta[dir] ?? 0;
      steps += 1;
    }
    const left = remaining - steps;
    if (left < 0) return 0;
    const button = buttonIndex[land] ?? -1;
    if (button >= 0 && button !== nextButton) return 0;
    if (!freeEnd) {
      // The last button is the final stitch, and the final stitch is the last button.
      if ((land === endCell) !== (left === 0)) return 0;
    }
    return steps;
  };

  const apply = (dir: number, steps: number): void => {
    let c = path[path.length - 1] ?? 0;
    const bit = axisBit(dir);
    for (let i = 1; i < steps; i++) {
      c += delta[dir] ?? 0;
      used[c] = (used[c] ?? 0) | bit;
      path.push(c);
    }
    c += delta[dir] ?? 0;
    visited[c] = 1;
    path.push(c);
    remaining -= steps;
    unvisited -= 1;
    if ((buttonIndex[c] ?? -1) >= 0) nextButton += 1;
  };

  const undo = (dir: number, steps: number): void => {
    const land = path.pop() ?? 0;
    visited[land] = 0;
    if ((buttonIndex[land] ?? -1) >= 0) nextButton -= 1;
    const bit = axisBit(dir);
    for (let i = 1; i < steps; i++) {
      const c = path.pop() ?? 0;
      used[c] = (used[c] ?? 0) & ~bit;
    }
    remaining += steps;
    unvisited += 1;
  };

  /** False when the cells left can no longer be finished from here. */
  const viable = (): boolean => {
    if (remaining === 0) return true;
    const head = path[path.length - 1] ?? 0;

    // Every free cell needs a way in and a way out. Only the end needs just one.
    let deadEnds = 0;
    for (let v = 0; v < count; v++) {
      if (isCross[v]) {
        const u = used[v] ?? 0;
        if (!(u & 1)) {
          const a = probe(v, LEFT);
          const b = probe(v, RIGHT);
          if (a < 0 || b < 0 || (visited[a] && a !== head) || (visited[b] && b !== head)) return false;
        }
        if (!(u & 2)) {
          const a = probe(v, 0);
          const b = probe(v, 2);
          if (a < 0 || b < 0 || (visited[a] && a !== head) || (visited[b] && b !== head)) return false;
        }
        continue;
      }
      if (visited[v]) continue;
      let exits = 0;
      for (let dir = 0; dir < 4; dir++) {
        const land = probe(v, dir);
        if (land >= 0 && (!visited[land] || land === head)) exits += 1;
      }
      if (exits === 0) return false;
      if (exits === 1) {
        if (freeEnd) {
          deadEnds += 1;
          if (deadEnds > 1) return false;
        } else if (v !== endCell) {
          return false;
        }
      }
    }

    // Every free cell must still be reachable from the head.
    seen.fill(0);
    let top = 0;
    stack[top++] = head;
    seen[head] = 1;
    let reached = 0;
    while (top > 0) {
      const u = stack[--top] ?? 0;
      for (let dir = 0; dir < 4; dir++) {
        const land = probe(u, dir);
        if (land >= 0 && !visited[land] && !seen[land]) {
          seen[land] = 1;
          reached += 1;
          stack[top++] = land;
        }
      }
    }
    return reached === unvisited;
  };

  return {
    path,
    tryMove,
    apply,
    undo,
    viable,
    done: () => remaining === 0,
  };
};

const ORDER = [0, 1, 2, 3];

export const solve = (board: Board, options: SolveOptions = {}): SolveResult => {
  const limit = options.limit ?? 2;
  const nodeCap = options.nodeCap ?? 200_000;
  const { rng } = options;
  const search = createSearch(board, options.freeEnd ?? false);
  const solutions: number[][] = [];
  let nodes = 0;
  let capped = false;

  const walk = (): void => {
    if (search.done()) {
      solutions.push([...search.path]);
      return;
    }
    let order = ORDER;
    if (rng) {
      order = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const a = order[i] ?? 0;
        order[i] = order[j] ?? 0;
        order[j] = a;
      }
    }
    for (const dir of order) {
      const steps = search.tryMove(dir);
      if (steps === 0) continue;
      nodes += 1;
      if (nodes > nodeCap) {
        capped = true;
        return;
      }
      search.apply(dir, steps);
      if (search.viable()) walk();
      search.undo(dir, steps);
      if (capped || solutions.length >= limit) return;
    }
  };

  if (board.total === 1) solutions.push([...search.path]);
  else walk();
  return { solutions, nodes, capped };
};

/** Walk a known solution and measure how often the player has a real choice. */
export const analyse = (board: Board, solution: readonly number[]): Analysis => {
  const search = createSearch(board, false);
  let decisions = 0;
  let forced = 0;
  let run = 0;
  let longestFreeRun = 0;
  let i = 1;
  while (i < solution.length) {
    let plausible = 0;
    let takeDir = -1;
    let takeSteps = 0;
    for (let dir = 0; dir < 4; dir++) {
      const steps = search.tryMove(dir);
      if (steps === 0) continue;
      search.apply(dir, steps);
      const ok = search.viable();
      const matches = search.path[i] === solution[i] && search.path[i + steps - 1] === solution[i + steps - 1];
      search.undo(dir, steps);
      if (ok) plausible += 1;
      if (matches) {
        takeDir = dir;
        takeSteps = steps;
      }
    }
    if (takeDir < 0) break; // not a solution of this board
    decisions += 1;
    if (plausible <= 1) {
      forced += 1;
      run = 0;
    } else {
      run += 1;
      if (run > longestFreeRun) longestFreeRun = run;
    }
    search.apply(takeDir, takeSteps);
    i += takeSteps;
  }
  return {
    forcedShare: decisions === 0 ? 1 : forced / decisions,
    longestFreeRun,
  };
};

/**
 * Difficulty score: search effort, how few moves are forced, and the longest stretch with
 * no forced move. The weights are a first guess, to be calibrated against David's solve
 * times (SPEC: 20 boards per tier).
 */
export const difficultyScore = (nodes: number, analysis: Analysis): number =>
  Math.round(
    10 * Math.log2(nodes + 1) + 60 * (1 - analysis.forcedShare) + 2 * analysis.longestFreeRun
  );

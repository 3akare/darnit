// Offline pattern generator. Builds a random thread, lays buttons and seams along it, then
// adds and removes clues until the solver proves there is exactly one solution.

import { compile, seamBetween } from './pattern.ts';
import type { Difficulty, StoredPattern } from './pattern.ts';
import { randomInt, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import { analyse, difficultyScore, solve } from './solver.ts';

type Tier = {
  sizes: [number, number];
  crosses: [number, number];
  /** Allowed button count for the finished pattern. */
  buttons: [number, number];
  /** Button count the reduction pass aims for. */
  targetButtons: [number, number];
  /** Seam count the reduction pass aims for: none or few, some, many. */
  targetSeams: [number, number];
  /** Most seams the finished pattern may carry. */
  maxSeams: number;
  /** Chance of fixing an ambiguity with a seam rather than a button. */
  seamBias: number;
  /** Accepted difficulty score band. A first guess until David's solve times calibrate it. */
  score: [number, number];
};

/** SPEC.md "Daily cycle and difficulty". */
export const TIERS: Record<Difficulty, Tier> = {
  easy: {
    sizes: [5, 6],
    crosses: [0, 0],
    buttons: [6, 10],
    targetButtons: [6, 9],
    targetSeams: [0, 2],
    maxSeams: 4,
    seamBias: 0.15,
    score: [0, 1000],
  },
  medium: {
    sizes: [6, 7],
    crosses: [1, 2],
    buttons: [8, 13],
    targetButtons: [8, 11],
    targetSeams: [3, 6],
    maxSeams: 10,
    seamBias: 0.45,
    score: [0, 1000],
  },
  hard: {
    sizes: [7, 8],
    crosses: [2, 3],
    buttons: [10, 16],
    targetButtons: [10, 13],
    targetSeams: [7, 12],
    maxSeams: 22,
    seamBias: 0.7,
    score: [0, 1000],
  },
};

const UNIQUE_CAP = 150_000;

type Draft = { size: number; buttons: number[]; seams: number[]; crosses: number[] };

const sameThread = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((cell, i) => cell === b[i]);

/**
 * Exactly one solution, proven within the node cap. When there are more, `other` is a
 * solution that differs from the intended thread.
 */
const proveUnique = (
  draft: Draft,
  thread: readonly number[]
): { unique: boolean; nodes: number; other: number[] | null } => {
  const result = solve(compile(draft), { limit: 2, nodeCap: UNIQUE_CAP });
  return {
    unique: !result.capped && result.solutions.length === 1,
    nodes: result.nodes,
    other: result.solutions.find((solution) => !sameThread(solution, thread)) ?? null,
  };
};

const placeCrosses = (rng: Rng, size: number, wanted: number): number[] => {
  const interior: number[] = [];
  for (let r = 1; r < size - 1; r++) for (let c = 1; c < size - 1; c++) interior.push(r * size + c);
  const chosen: number[] = [];
  for (const cell of shuffle(rng, interior)) {
    if (chosen.length === wanted) break;
    // Keep cross-stitch cells apart so each one reads as its own crossing.
    const clear = chosen.every(
      (other) =>
        Math.abs(Math.floor(other / size) - Math.floor(cell / size)) > 1 ||
        Math.abs((other % size) - (cell % size)) > 1
    );
    if (clear) chosen.push(cell);
  }
  return chosen;
};

/** A random thread that fills the fabric and passes each cross-stitch cell both ways. */
const randomThread = (rng: Rng, size: number, crosses: number[]): number[] | null => {
  const cross = new Set(crosses);
  // Each step moves to the other checkerboard colour, so the stitches on the two colours
  // can differ by at most one, and an uneven thread must start on the fuller colour.
  const colour = (cell: number): number => (Math.floor(cell / size) + (cell % size)) % 2;
  const stitches = [0, 0];
  for (let cell = 0; cell < size * size; cell++) stitches[colour(cell)] = (stitches[colour(cell)] ?? 0) + 1;
  for (const cell of crosses) stitches[colour(cell)] = (stitches[colour(cell)] ?? 0) + 1;
  const lead = (stitches[0] ?? 0) - (stitches[1] ?? 0);
  if (Math.abs(lead) > 1) return null;
  const starts: number[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    if (cross.has(cell)) continue;
    if (lead === 0 || colour(cell) === (lead > 0 ? 0 : 1)) starts.push(cell);
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const start = starts[randomInt(rng, 0, starts.length - 1)] ?? 0;
    const board = compile({ size, buttons: [start], seams: [], crosses });
    const result = solve(board, { limit: 1, nodeCap: 20_000, freeEnd: true, rng });
    const thread = result.solutions[0];
    if (thread) return thread;
  }
  return null;
};

/** Thread positions that can carry a button: plain cells only. */
const buttonSpots = (thread: number[], crosses: number[]): number[] => {
  const cross = new Set(crosses);
  const spots: number[] = [];
  thread.forEach((cell, i) => {
    if (!cross.has(cell)) spots.push(i);
  });
  return spots;
};

/**
 * Build one pattern of the given difficulty, or null if this attempt did not settle.
 * Callers retry with the same generator until it returns a pattern.
 */
export const generatePattern = (difficulty: Difficulty, rng: Rng, id: string): StoredPattern | null => {
  const tier = TIERS[difficulty];
  const size = randomInt(rng, tier.sizes[0], tier.sizes[1]);
  const crosses = placeCrosses(rng, size, randomInt(rng, tier.crosses[0], tier.crosses[1]));
  if (crosses.length < tier.crosses[0]) return null;
  const thread = randomThread(rng, size, crosses);
  if (!thread) return null;

  const spots = buttonSpots(thread, crosses);
  const last = thread.length - 1;
  const [minButtons, maxButtons] = tier.buttons;

  // Buttons are tracked as positions along the thread so they stay in order.
  const wanted = randomInt(rng, tier.targetButtons[0], tier.targetButtons[1]);
  const wantedSeams = randomInt(rng, tier.targetSeams[0], tier.targetSeams[1]);
  const positions = new Set<number>([0, last]);
  for (let k = 1; k < wanted - 1; k++) {
    const ideal = Math.round((k * last) / (wanted - 1)) + randomInt(rng, -1, 1);
    const spot = spots.reduce((best, s) => (Math.abs(s - ideal) < Math.abs(best - ideal) ? s : best), 0);
    positions.add(spot);
  }

  // Seams may sit on any edge the thread does not cross.
  const usedEdges = new Set<number>();
  for (let i = 1; i < thread.length; i++) {
    usedEdges.add(seamBetween(size, thread[i - 1] ?? 0, thread[i] ?? 0));
  }
  const freeEdges: number[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    if (cell % size < size - 1 && !usedEdges.has(cell * 2)) freeEdges.push(cell * 2);
    if (cell + size < size * size && !usedEdges.has(cell * 2 + 1)) freeEdges.push(cell * 2 + 1);
  }
  const seams = new Set<number>(
    shuffle(rng, freeEdges).slice(0, wantedSeams)
  );

  const draft = (): Draft => ({
    size,
    buttons: [...positions].sort((a, b) => a - b).map((p) => thread[p] ?? 0),
    seams: [...seams].sort((a, b) => a - b),
    crosses,
  });

  // Add clues until the solution is unique.
  let proof = proveUnique(draft(), thread);
  for (let round = 0; !proof.unique; round++) {
    if (round > 80) return null;
    let added = false;
    const other = proof.other;
    if (other) {
      // Find where the other solution leaves ours and block or pin that spot.
      let split = 0;
      while (split + 1 < thread.length && other[split + 1] === thread[split + 1]) split += 1;
      const wrongEdge = seamBetween(size, thread[split] ?? 0, other[split + 1] ?? 0);
      const canSeam = wrongEdge >= 0 && !usedEdges.has(wrongEdge) && !seams.has(wrongEdge) && seams.size < tier.maxSeams;
      const pin = spots.find((s) => s > split && !positions.has(s));
      const canPin = pin !== undefined && positions.size < maxButtons;
      if (canSeam && (!canPin || rng() < tier.seamBias)) {
        seams.add(wrongEdge);
        added = true;
      } else if (canPin && pin !== undefined) {
        positions.add(pin);
        added = true;
      } else if (canSeam) {
        seams.add(wrongEdge);
        added = true;
      }
    }
    if (!added) {
      // The search ran out of budget, or the split could not be fixed: pin the widest gap.
      if (positions.size >= maxButtons) return null;
      const sorted = [...positions].sort((a, b) => a - b);
      let bestGap = 0;
      let bestSpot = -1;
      for (let i = 1; i < sorted.length; i++) {
        const lo = sorted[i - 1] ?? 0;
        const hi = sorted[i] ?? 0;
        const mid = Math.round((lo + hi) / 2);
        const spot = spots.find((s) => s >= mid && s < hi && !positions.has(s));
        if (spot !== undefined && hi - lo > bestGap) {
          bestGap = hi - lo;
          bestSpot = spot;
        }
      }
      if (bestSpot < 0) return null;
      positions.add(bestSpot);
    }
    proof = proveUnique(draft(), thread);
  }

  // Remove clues one at a time while the solution stays unique.
  type Clue = { kind: 'button'; at: number } | { kind: 'seam'; edge: number };
  const clues: Clue[] = shuffle(rng, [
    ...[...positions].filter((p) => p !== 0 && p !== last).map((at): Clue => ({ kind: 'button', at })),
    ...[...seams].map((edge): Clue => ({ kind: 'seam', edge })),
  ]);
  // Easy days should end up with no seams, or few: try those first.
  if (difficulty === 'easy') clues.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'seam' ? -1 : 1));
  for (const clue of clues) {
    if (clue.kind === 'button') {
      if (positions.size <= wanted) continue;
      positions.delete(clue.at);
      if (!proveUnique(draft(), thread).unique) positions.add(clue.at);
    } else {
      if (seams.size <= wantedSeams) continue;
      seams.delete(clue.edge);
      if (!proveUnique(draft(), thread).unique) seams.add(clue.edge);
    }
  }

  if (positions.size < minButtons || positions.size > maxButtons) return null;
  const final = draft();
  const board = compile(final);
  const settled = solve(board, { limit: 2, nodeCap: UNIQUE_CAP });
  if (settled.capped || settled.solutions.length !== 1) return null;
  const score = difficultyScore(settled.nodes, analyse(board, thread));
  if (score < tier.score[0] || score > tier.score[1]) return null;
  return { id, ...final, difficulty, solution: thread, score };
};

/** Keep trying until a pattern settles. Deterministic for a given generator state. */
export const generateOne = (difficulty: Difficulty, rng: Rng, id: string): StoredPattern => {
  for (let attempt = 0; attempt < 500; attempt++) {
    const pattern = generatePattern(difficulty, rng, id);
    if (pattern) return pattern;
  }
  throw new Error(`could not generate a ${difficulty} pattern after 500 attempts`);
};

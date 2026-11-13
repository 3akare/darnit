// The pattern bank and the rule that picks each day's pattern.

import type { Difficulty, StoredPattern } from '../../shared/puzzle/pattern.ts';
import type { Rng } from '../../shared/puzzle/rng.ts';
import raw from './patterns.json' with { type: 'json' };

const isDifficulty = (value: string): value is Difficulty =>
  value === 'easy' || value === 'medium' || value === 'hard';

export const BANK: StoredPattern[] = raw.map((entry) => {
  if (!isDifficulty(entry.difficulty)) throw new Error(`bad difficulty on ${entry.id}`);
  return { ...entry, difficulty: entry.difficulty };
});

const BY_ID = new Map(BANK.map((pattern) => [pattern.id, pattern]));

export const getPattern = (id: string): StoredPattern | undefined => BY_ID.get(id);

/** SPEC: 40% easy, 40% medium, 20% hard. */
const WEIGHTS: [Difficulty, number][] = [
  ['easy', 0.4],
  ['medium', 0.4],
  ['hard', 0.2],
];

/**
 * Pick the next day's pattern: weighted random difficulty, never more than two hard days in
 * a row, never a pattern that has already run. `history` is every earlier day, oldest first.
 * Returns undefined only when the whole bank has been used.
 */
export const pickDaily = (
  rng: Rng,
  history: readonly string[],
  bank: readonly StoredPattern[] = BANK
): StoredPattern | undefined => {
  const used = new Set(history);
  const unused = bank.filter((pattern) => !used.has(pattern.id));
  if (unused.length === 0) return undefined;

  const byId = new Map(bank.map((pattern) => [pattern.id, pattern]));
  const lastTwo = history.slice(-2).map((id) => byId.get(id)?.difficulty);
  const hardBlocked = lastTwo.length === 2 && lastTwo.every((d) => d === 'hard');

  const roll = rng();
  let wanted: Difficulty = 'easy';
  let edge = 0;
  for (const [difficulty, weight] of WEIGHTS) {
    edge += weight;
    wanted = difficulty;
    if (roll < edge) break;
  }
  if (wanted === 'hard' && hardBlocked) wanted = rng() < 0.5 ? 'easy' : 'medium';

  // If the wanted tier has run dry, fall back to another one, still honouring the hard rule.
  const order: Difficulty[] = [wanted, 'medium', 'easy', 'hard'];
  for (const difficulty of order) {
    if (difficulty === 'hard' && hardBlocked) continue;
    const pool = unused.filter((pattern) => pattern.difficulty === difficulty);
    if (pool.length > 0) return pool[Math.floor(rng() * pool.length)];
  }
  return unused[Math.floor(rng() * unused.length)];
};

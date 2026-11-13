// Rebuilds the pattern bank: node --experimental-strip-types tools/generate-bank.ts
// The seed is fixed, so the same code always writes the same bank.

import { writeFileSync } from 'node:fs';
import { generateOne } from '../src/shared/puzzle/generator.ts';
import type { Difficulty, StoredPattern } from '../src/shared/puzzle/pattern.ts';
import { seeded } from '../src/shared/puzzle/rng.ts';

/** Enough of each tier for 60 days at 40/40/20 with room for an unlucky run of draws. */
const COUNTS: [Difficulty, string, number][] = [
  ['easy', 'e', 34],
  ['medium', 'm', 34],
  ['hard', 'h', 22],
];

const rng = seeded(20261125);
const bank: StoredPattern[] = [];
for (const [difficulty, prefix, count] of COUNTS) {
  for (let i = 1; i <= count; i++) {
    bank.push(generateOne(difficulty, rng, `${prefix}${String(i).padStart(2, '0')}`));
  }
  console.log(`${difficulty}: ${count} patterns`);
}

const lines = bank.map((pattern) => `  ${JSON.stringify(pattern)}`);
writeFileSync(new URL('../src/server/bank/patterns.json', import.meta.url), `[\n${lines.join(',\n')}\n]\n`);
console.log(`wrote ${bank.length} patterns`);

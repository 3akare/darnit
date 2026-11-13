import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSoundPattern } from '../../../tools/assert-sound-pattern.ts';
import { generateOne } from './generator.ts';
import type { Difficulty } from './pattern.ts';
import { seeded } from './rng.ts';

const TIER_NAMES: Difficulty[] = ['easy', 'medium', 'hard'];

for (const difficulty of TIER_NAMES) {
  test(`generated ${difficulty} patterns are sound`, () => {
    const rng = seeded(4242);
    for (let i = 0; i < 6; i++) assertSoundPattern(generateOne(difficulty, rng, `${difficulty}-${i}`));
  });
}

test('the same seed gives the same pattern', () => {
  const a = generateOne('medium', seeded(7), 'a');
  const b = generateOne('medium', seeded(7), 'a');
  assert.deepEqual(a, b);
});

test('easy days have no cross-stitch cells', () => {
  const rng = seeded(11);
  for (let i = 0; i < 5; i++) assert.equal(generateOne('easy', rng, `e${i}`).crosses.length, 0);
});

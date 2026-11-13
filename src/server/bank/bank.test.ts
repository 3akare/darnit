import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSoundPattern } from '../../../tools/assert-sound-pattern.ts';
import { seeded } from '../../shared/puzzle/rng.ts';
import { BANK, pickDaily } from './bank.ts';

test('the bank holds at least 60 days of patterns with unique ids', () => {
  assert.ok(BANK.length >= 60, `bank has ${BANK.length} patterns`);
  assert.equal(new Set(BANK.map((p) => p.id)).size, BANK.length);
});

test('every bank pattern is solvable, unique and obeys the cross-stitch rule', () => {
  for (const pattern of BANK) assertSoundPattern(pattern);
});

test('no two bank patterns are the same puzzle', () => {
  const keys = BANK.map((p) => JSON.stringify([p.size, p.buttons, p.seams, p.crosses]));
  assert.equal(new Set(keys).size, BANK.length);
});

test('60 days of picks never repeat and never run three hard days in a row', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    const history: string[] = [];
    let hardRun = 0;
    for (let day = 0; day < 60; day++) {
      const pattern = pickDaily(rng, history);
      assert.ok(pattern, `seed ${seed} ran out on day ${day}`);
      assert.ok(!history.includes(pattern.id), `seed ${seed} repeated ${pattern.id}`);
      hardRun = pattern.difficulty === 'hard' ? hardRun + 1 : 0;
      assert.ok(hardRun <= 2, `seed ${seed}: three hard days in a row at day ${day}`);
      history.push(pattern.id);
    }
  }
});

test('picks follow the 40/40/20 split', () => {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (let seed = 1; seed <= 4000; seed++) {
    const pattern = pickDaily(seeded(seed), []);
    assert.ok(pattern);
    counts[pattern.difficulty] += 1;
  }
  assert.ok(Math.abs(counts.easy / 4000 - 0.4) < 0.03, `easy share ${counts.easy / 4000}`);
  assert.ok(Math.abs(counts.medium / 4000 - 0.4) < 0.03, `medium share ${counts.medium / 4000}`);
  assert.ok(Math.abs(counts.hard / 4000 - 0.2) < 0.03, `hard share ${counts.hard / 4000}`);
});

test('the picker returns undefined once the bank is used up', () => {
  assert.equal(pickDaily(seeded(1), BANK.map((p) => p.id)), undefined);
});

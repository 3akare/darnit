// Shared by the generator test and the bank test.

import assert from 'node:assert/strict';
import { TIERS } from '../src/shared/puzzle/generator.ts';
import { checkThread, compile, seamBetween } from '../src/shared/puzzle/pattern.ts';
import type { StoredPattern } from '../src/shared/puzzle/pattern.ts';
import { solve } from '../src/shared/puzzle/solver.ts';

/** The checks every pattern must pass: SPEC ranges, a valid stored solution, exactly one solution. */
export const assertSoundPattern = (pattern: StoredPattern): void => {
  const tier = TIERS[pattern.difficulty];
  const { size } = pattern;
  const label = `${pattern.id} (${pattern.difficulty} ${size}x${size})`;
  const board = compile(pattern);

  assert.ok(size >= tier.sizes[0] && size <= tier.sizes[1], `${label}: grid size in range`);
  assert.ok(
    pattern.buttons.length >= tier.buttons[0] && pattern.buttons.length <= tier.buttons[1],
    `${label}: ${pattern.buttons.length} buttons in range`
  );
  assert.ok(
    pattern.crosses.length >= tier.crosses[0] && pattern.crosses.length <= tier.crosses[1],
    `${label}: ${pattern.crosses.length} cross-stitch cells in range`
  );
  assert.ok(pattern.seams.length <= tier.maxSeams, `${label}: seam count in range`);

  // Cross-stitch cells: interior only, never on a button.
  for (const cell of pattern.crosses) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    assert.ok(row > 0 && row < size - 1 && col > 0 && col < size - 1, `${label}: cross-stitch cell ${cell} is interior`);
    assert.ok(!pattern.buttons.includes(cell), `${label}: cross-stitch cell ${cell} is not a button`);
  }
  assert.equal(new Set(pattern.buttons).size, pattern.buttons.length, `${label}: buttons are distinct`);

  // The stored solution is a legal, complete thread.
  assert.deepEqual(checkThread(board, pattern.solution), { ok: true }, `${label}: stored solution is valid`);
  for (const cell of pattern.crosses) {
    assert.equal(pattern.solution.filter((c) => c === cell).length, 2, `${label}: cross-stitch cell ${cell} passed twice`);
  }
  // The thread never crosses a seam.
  const seams = new Set(pattern.seams);
  for (let i = 1; i < pattern.solution.length; i++) {
    const edge = seamBetween(size, pattern.solution[i - 1] ?? 0, pattern.solution[i] ?? 0);
    assert.ok(!seams.has(edge), `${label}: thread crosses seam ${edge}`);
  }

  // Exactly one solution, and it is the stored one.
  const result = solve(board, { limit: 2, nodeCap: 2_000_000 });
  assert.equal(result.capped, false, `${label}: uniqueness proof finished`);
  assert.equal(result.solutions.length, 1, `${label}: exactly one solution`);
  assert.deepEqual(result.solutions[0], pattern.solution, `${label}: the solution is the stored one`);
};

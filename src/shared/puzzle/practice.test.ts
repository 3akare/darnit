import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkThread, compile } from './pattern.ts';
import { PRACTICE, guideCell } from './practice.ts';
import { solve } from './solver.ts';

test('the practice pattern has exactly one solution, the stored one', () => {
  const board = compile(PRACTICE);
  assert.deepEqual(checkThread(board, PRACTICE.solution), { ok: true });
  const result = solve(board, { limit: 2 });
  assert.equal(result.capped, false);
  assert.deepEqual(result.solutions, [PRACTICE.solution]);
});

test('the guide points at the next step, or back to the last good square', () => {
  assert.deepEqual(guideCell([0], PRACTICE.solution), { cell: 1, back: false });
  assert.deepEqual(guideCell([0, 1, 2], PRACTICE.solution), { cell: 3, back: false });
  assert.deepEqual(guideCell([0, 1, 5], PRACTICE.solution), { cell: 1, back: true });
  assert.deepEqual(guideCell([0, 4], PRACTICE.solution), { cell: 0, back: true });
  assert.deepEqual(guideCell(PRACTICE.solution, PRACTICE.solution), { cell: -1, back: false });
});

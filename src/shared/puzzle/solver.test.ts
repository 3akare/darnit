import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkThread, compile, seamBelow } from './pattern.ts';
import { seeded } from './rng.ts';
import { analyse, solve } from './solver.ts';

test('3x3 corner to opposite corner has exactly the two S-shaped solutions', () => {
  const result = solve(compile({ size: 3, buttons: [0, 8], seams: [], crosses: [] }), { limit: 10 });
  assert.equal(result.capped, false);
  assert.deepEqual(result.solutions, [
    [0, 1, 2, 5, 4, 3, 6, 7, 8],
    [0, 3, 6, 7, 4, 1, 2, 5, 8],
  ]);
});

test('button order picks one of the two S shapes', () => {
  // One S reaches cell 2 before cell 6, the other reaches 6 first.
  const first = solve(compile({ size: 3, buttons: [0, 2, 6, 8], seams: [], crosses: [] }), { limit: 10 });
  assert.deepEqual(first.solutions, [[0, 1, 2, 5, 4, 3, 6, 7, 8]]);
  const second = solve(compile({ size: 3, buttons: [0, 6, 2, 8], seams: [], crosses: [] }), { limit: 10 });
  assert.deepEqual(second.solutions, [[0, 3, 6, 7, 4, 1, 2, 5, 8]]);
});

test('a button may be reached later than the step after the previous one', () => {
  // Cell 1 is button 2. Both S shapes pass it after the start, so both still count.
  const result = solve(compile({ size: 3, buttons: [0, 1, 8], seams: [], crosses: [] }), { limit: 10 });
  assert.equal(result.solutions.length, 2);
});

test('a seam makes the 3x3 unique', () => {
  const result = solve(compile({ size: 3, buttons: [0, 8], seams: [seamBelow(0)], crosses: [] }), { limit: 10 });
  assert.deepEqual(result.solutions, [[0, 1, 2, 5, 4, 3, 6, 7, 8]]);
});

test('an impossible board has no solution', () => {
  // Neighbouring corners on a 3x3 cannot be joined by a thread that fills every cell.
  const result = solve(compile({ size: 3, buttons: [0, 1], seams: [], crosses: [] }), { limit: 10 });
  assert.equal(result.solutions.length, 0);
  assert.equal(result.capped, false);
});

test('every solution of a cross-stitch board obeys the cross-stitch rule', () => {
  // 4x4 with a cross-stitch cell at 5, start at 0, end anywhere: 18 threads by enumeration.
  const board = compile({ size: 4, buttons: [0], seams: [], crosses: [5] });
  const result = solve(board, { limit: 1000, freeEnd: true });
  assert.equal(result.solutions.length, 18);
  for (const thread of result.solutions) {
    assert.equal(thread.length, 17);
    assert.equal(thread.filter((cell) => cell === 5).length, 2);
    const end = thread[thread.length - 1] ?? -1;
    const fixed = compile({ size: 4, buttons: [0, end], seams: [], crosses: [5] });
    assert.deepEqual(checkThread(fixed, thread), { ok: true });
  }
});

test('the solver finds the hand-checked cross-stitch thread', () => {
  const thread = [0, 1, 5, 9, 10, 6, 5, 4, 8, 12, 13, 14, 15, 11, 7, 3, 2];
  const board = compile({ size: 4, buttons: [0, 2], seams: [], crosses: [5] });
  const result = solve(board, { limit: 1000 });
  assert.ok(result.solutions.some((s) => s.join() === thread.join()));
  for (const s of result.solutions) assert.deepEqual(checkThread(board, s), { ok: true });
});

test('the search stops at the solution limit', () => {
  const result = solve(compile({ size: 5, buttons: [0, 24], seams: [], crosses: [] }), { limit: 2 });
  assert.equal(result.solutions.length, 2);
});

test('the node cap marks the result as capped', () => {
  const result = solve(compile({ size: 8, buttons: [0, 63], seams: [], crosses: [] }), { limit: 1_000_000, nodeCap: 500 });
  assert.equal(result.capped, true);
});

test('a random free-end thread fills the fabric', () => {
  const rng = seeded(1);
  // One cross-stitch cell on each checkerboard colour, so a thread exists.
  const board = compile({ size: 6, buttons: [0], seams: [], crosses: [8, 21] });
  const result = solve(board, { limit: 1, freeEnd: true, rng });
  const thread = result.solutions[0];
  assert.ok(thread);
  assert.equal(thread.length, 38);
  assert.equal(new Set(thread).size, 36);
});

test('two cross-stitch cells on the same checkerboard colour leave no thread', () => {
  // Steps alternate colours, so a 6x6 thread needs 19 stitches on each colour. Two extra
  // passes on the same colour make that impossible from any start.
  const board = compile({ size: 6, buttons: [0], seams: [], crosses: [14, 21] });
  const result = solve(board, { limit: 1, freeEnd: true, nodeCap: 5_000_000 });
  assert.equal(result.capped, false);
  assert.equal(result.solutions.length, 0);
});

test('analyse reports every move as forced on a one-lane board', () => {
  // Seams turn the 3x3 into a single corridor.
  const board = compile({ size: 3, buttons: [0, 8], seams: [seamBelow(0), seamBelow(1), seamBelow(4), seamBelow(5)], crosses: [] });
  const result = solve(board, { limit: 2 });
  assert.equal(result.solutions.length, 1);
  const analysis = analyse(board, result.solutions[0] ?? []);
  assert.equal(analysis.forcedShare, 1);
  assert.equal(analysis.longestFreeRun, 0);
});

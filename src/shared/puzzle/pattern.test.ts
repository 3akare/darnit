import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkThread, compile, isComplete, seamBelow, seamBetween, seamRight, stepProblem } from './pattern.ts';

// 4x4 fabric, cells numbered:
//  0  1  2  3
//  4  5  6  7
//  8  9 10 11
// 12 13 14 15
const CROSS_BOARD = compile({ size: 4, buttons: [0, 2], seams: [], crosses: [5] });
// Hand-checked: down through the cross-stitch cell (1,5,9), later across it (6,5,4).
const CROSS_THREAD = [0, 1, 5, 9, 10, 6, 5, 4, 8, 12, 13, 14, 15, 11, 7, 3, 2];

test('seam ids name the edge between two neighbours', () => {
  assert.equal(seamBetween(4, 5, 6), seamRight(5));
  assert.equal(seamBetween(4, 6, 5), seamRight(5));
  assert.equal(seamBetween(4, 5, 9), seamBelow(5));
  assert.equal(seamBetween(4, 3, 4), -1, 'end of one row and start of the next are not neighbours');
  assert.equal(seamBetween(4, 0, 5), -1);
});

test('a step must go to a neighbouring cell', () => {
  const board = compile({ size: 3, buttons: [0, 8], seams: [], crosses: [] });
  assert.equal(stepProblem(board, [0], 1), null);
  assert.equal(stepProblem(board, [0], 3), null);
  assert.equal(stepProblem(board, [0], 4), 'not-adjacent');
  assert.equal(stepProblem(board, [0, 1, 2], 3), 'not-adjacent', 'no wrapping round the edge');
});

test('seams block movement in both directions', () => {
  const board = compile({ size: 3, buttons: [0, 8], seams: [seamRight(0), seamBelow(4)], crosses: [] });
  assert.equal(stepProblem(board, [0], 1), 'seam');
  assert.equal(stepProblem(board, [0, 3, 4], 7), 'seam');
  assert.equal(stepProblem(board, [0, 3, 6, 7], 4), 'seam');
  assert.equal(stepProblem(board, [0], 3), null);
});

test('a plain cell holds the thread once', () => {
  const board = compile({ size: 3, buttons: [0, 8], seams: [], crosses: [] });
  assert.equal(stepProblem(board, [0, 1, 4, 3], 0), 'occupied');
});

test('buttons must be reached in number order', () => {
  const board = compile({ size: 3, buttons: [0, 2, 8], seams: [], crosses: [] });
  assert.equal(stepProblem(board, [0, 3, 6, 7], 8), 'button-order');
  assert.equal(stepProblem(board, [0, 1], 2), null);
  assert.equal(stepProblem(board, [0, 1, 2, 5], 8), null);
});

test('the thread goes straight through a cross-stitch cell', () => {
  assert.equal(stepProblem(CROSS_BOARD, [0, 1, 5], 9), null);
  assert.equal(stepProblem(CROSS_BOARD, [0, 1, 5], 4), 'must-go-straight');
  assert.equal(stepProblem(CROSS_BOARD, [0, 1, 5], 6), 'must-go-straight');
});

test('a cross-stitch cell takes one pass across and one pass down, no more', () => {
  const afterDown = [0, 1, 5, 9, 10, 6];
  assert.equal(stepProblem(CROSS_BOARD, afterDown, 5), null, 'second pass on the other axis');
  const afterAcross = [0, 4, 5, 6, 2, 1];
  assert.equal(stepProblem(CROSS_BOARD, afterAcross, 5), null);
  const downTwice = [0, 1, 5, 9, 13, 12, 8, 4];
  assert.equal(stepProblem(CROSS_BOARD, downTwice, 5), null, 'across after down is fine');
  const sameAxis = [0, 1, 5, 9, 8];
  assert.equal(stepProblem(CROSS_BOARD, [...sameAxis, 4, 0], 1), 'occupied');
  // Thread went down through 5; coming back up through it is the same axis.
  assert.equal(stepProblem(CROSS_BOARD, [0, 1, 5, 9], 5), 'cross-used');
});

test('checkThread accepts the hand-checked cross-stitch thread', () => {
  assert.deepEqual(checkThread(CROSS_BOARD, CROSS_THREAD), { ok: true });
  assert.equal(isComplete(CROSS_BOARD, CROSS_THREAD), true);
});

test('checkThread rejects threads that break a rule', () => {
  const board = compile({ size: 3, buttons: [0, 8], seams: [], crosses: [] });
  const good = [0, 1, 2, 5, 4, 3, 6, 7, 8];
  assert.deepEqual(checkThread(board, good), { ok: true });
  assert.equal(checkThread(board, []).ok, false);
  assert.equal(checkThread(board, [1, 0, 3, 4, 5, 2]).ok, false, 'wrong start');
  assert.equal(checkThread(board, good.slice(0, 8)).ok, false, 'cells left unfilled');
  assert.equal(checkThread(board, [0, 1, 2, 5, 8]).ok, false, 'reached the last button early');
  assert.equal(checkThread(board, [0, 1, 2, 5, 4, 3, 6, 7, 99]).ok, false, 'off the fabric');
  assert.equal(checkThread(board, [0, 1, 2, 5, 4, 3, 6, 7, 4]).ok, false, 'revisits a cell');
  const walled = compile({ size: 3, buttons: [0, 8], seams: [seamRight(0)], crosses: [] });
  assert.equal(checkThread(walled, good).ok, false, 'crosses a seam');
});

test('a thread that skips a cross-stitch pass is not complete', () => {
  // Fills every cell once but passes the cross-stitch cell only once.
  const once = [0, 1, 5, 9, 8, 4];
  assert.equal(checkThread(CROSS_BOARD, once).ok, false);
});

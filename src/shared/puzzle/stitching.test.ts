import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile, seamRight } from './pattern.ts';
import { createUnpickCounter, cutTo, dragTo, resetThread, undoStitch } from './stitching.ts';

// 4x4 fabric:
//  0  1  2  3
//  4  5  6  7
//  8  9 10 11
// 12 13 14 15
const PLAIN = compile({ size: 4, buttons: [0, 15], seams: [], crosses: [] });
const CROSS = compile({ size: 4, buttons: [0, 2], seams: [], crosses: [5] });

test('dragging onto a free neighbour extends the thread', () => {
  assert.deepEqual(dragTo(PLAIN, [0], 1), { thread: [0, 1], added: 1, removed: 0 });
});

test('a fast swipe fills the cells it skipped', () => {
  assert.deepEqual(dragTo(PLAIN, [0], 3).thread, [0, 1, 2, 3]);
  assert.deepEqual(dragTo(PLAIN, [0], 12).thread, [0, 4, 8, 12]);
});

test('a skipped run stops at the first illegal step', () => {
  const walled = compile({ size: 4, buttons: [0, 15], seams: [seamRight(1)], crosses: [] });
  assert.deepEqual(dragTo(walled, [0], 3).thread, [0, 1]);
});

test('touching an earlier part of the thread does NOT cut it', () => {
  // Thread loops round and the head (cell 4) sits next to its own tail at cell 0.
  const loop = [1, 2, 6, 5, 4];
  const board = compile({ size: 4, buttons: [1, 15], seams: [], crosses: [] });
  assert.deepEqual(dragTo(board, loop, 5), { thread: [1, 2, 6, 5], added: 0, removed: 1 }, 'one step back is an unpick');
  const head = [1, 2, 6, 5, 9, 8, 4, 0];
  assert.deepEqual(dragTo(board, head, 1), { thread: head, added: 0, removed: 0 }, 'head touching the body changes nothing');
  const side = [1, 2, 6, 10, 9, 5];
  assert.deepEqual(dragTo(board, side, 6), { thread: side, added: 0, removed: 0 });
  assert.deepEqual(dragTo(board, side, 1), { thread: side, added: 0, removed: 0 });
});

test('dragging back along the thread unpicks one cell per cell crossed', () => {
  const thread = [0, 1, 2, 3, 7];
  assert.deepEqual(dragTo(PLAIN, thread, 3), { thread: [0, 1, 2, 3], added: 0, removed: 1 });
  assert.deepEqual(dragTo(PLAIN, [0, 1, 2, 3], 1), { thread: [0, 1], added: 0, removed: 2 }, 'fast drag back');
});

test('the thread cannot be unpicked past button 1', () => {
  assert.deepEqual(dragTo(PLAIN, [0, 1], 0), { thread: [0], added: 0, removed: 1 });
  assert.deepEqual(undoStitch([0]), { thread: [0], added: 0, removed: 0 });
});

test('a diagonal drag takes the longer leg first', () => {
  assert.deepEqual(dragTo(PLAIN, [0], 6).thread, [0, 1, 2, 6]);
  assert.deepEqual(dragTo(PLAIN, [0], 13).thread, [0, 4, 8, 9, 13]);
  // Equal legs: step across, then down, like a staircase.
  assert.deepEqual(dragTo(PLAIN, [0], 5).thread, [0, 1, 5]);
});

test('a diagonal drag adds a stitch rather than unpicking when it could do either', () => {
  // From 0 toward 5, where cell 1 is the cell behind the head: go down then across.
  const board = compile({ size: 4, buttons: [1, 15], seams: [], crosses: [] });
  assert.deepEqual(dragTo(board, [1, 0], 5).thread, [1, 0, 4, 5]);
});

test('the thread carries straight through a cross-stitch cell and may cross it again', () => {
  assert.deepEqual(dragTo(CROSS, [0, 1], 9).thread, [0, 1, 5, 9]);
  // Head resting on the cross-stitch cell cannot turn.
  assert.deepEqual(dragTo(CROSS, [0, 1, 5], 4).thread, [0, 1, 5]);
  assert.deepEqual(dragTo(CROSS, [0, 1, 5], 6).thread, [0, 1, 5]);
  // Second pass on the other axis.
  assert.deepEqual(dragTo(CROSS, [0, 1, 5, 9, 10, 6], 4).thread, [0, 1, 5, 9, 10, 6, 5, 4]);
  // Backing out of a half-made crossing unpicks it.
  assert.deepEqual(dragTo(CROSS, [0, 1, 5, 9, 10, 6, 5], 6).thread, [0, 1, 5, 9, 10, 6]);
});

test('buttons cannot be stitched out of order', () => {
  const board = compile({ size: 4, buttons: [0, 3, 1, 15], seams: [], crosses: [] });
  assert.deepEqual(dragTo(board, [0], 1).thread, [0], 'button 3 before button 2');
  assert.deepEqual(dragTo(board, [0, 4, 5, 6, 2, 3], 2).thread, [0, 4, 5, 6, 2], 'back one is still an unpick');
});

test('a tap cuts back to an earlier cell, and only a tap does', () => {
  assert.deepEqual(cutTo([0, 1, 2, 3, 7], 1), { thread: [0, 1], added: 0, removed: 3 });
  assert.deepEqual(cutTo([0, 1, 2], 2), { thread: [0, 1, 2], added: 0, removed: 0 }, 'tapping the head does nothing');
  assert.deepEqual(cutTo([0, 1, 2], 9), { thread: [0, 1, 2], added: 0, removed: 0 }, 'tapping off the thread does nothing');
  // A cross-stitch cell passed twice: cut to the later pass.
  assert.deepEqual(cutTo([0, 1, 5, 9, 10, 6, 5, 4, 8], 5).thread, [0, 1, 5, 9, 10, 6, 5]);
});

test('undo removes one cell and reset leaves only button 1', () => {
  assert.deepEqual(undoStitch([0, 1, 2]), { thread: [0, 1], added: 0, removed: 1 });
  assert.deepEqual(resetThread(PLAIN, [0, 1, 2]), { thread: [0], added: 0, removed: 2 });
  assert.deepEqual(resetThread(PLAIN, [0]), { thread: [0], added: 0, removed: 0 });
});

test('one continuous retreat counts as one unpick', () => {
  const counter = createUnpickCounter();
  counter.note({ thread: [], added: 3, removed: 0 });
  assert.equal(counter.count, 0);
  // Drag back ten cells in one motion, reported as several small steps.
  for (let i = 0; i < 10; i++) counter.note({ thread: [], added: 0, removed: 1 });
  assert.equal(counter.count, 1);
  // Back-to-back undos join the same retreat.
  counter.note({ thread: [], added: 0, removed: 1 });
  assert.equal(counter.count, 1);
  // Stitching again ends it; the next retreat is a new unpick.
  counter.note({ thread: [], added: 1, removed: 0 });
  counter.note({ thread: [], added: 0, removed: 4 });
  assert.equal(counter.count, 2);
  // A gesture that changes nothing is not an unpick.
  counter.note({ thread: [], added: 0, removed: 0 });
  assert.equal(counter.count, 2);
});

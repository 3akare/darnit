import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HINT_COOLDOWN_MS, badgeFor, badgeLabel, formatTime, ordinal, shareText, standingLine } from '../../shared/api.ts';
import type { StoredPattern } from '../../shared/puzzle/pattern.ts';
import { seeded } from '../../shared/puzzle/rng.ts';
import { chooseNextPattern, currentDay, dayForPost, nextResetAt, postTitle, recordDay } from './days.ts';
import { MIN_MS_PER_CELL, getRun, getStanding, leaderboardKey, startRun, submitRun, takeHint } from './runs.ts';
import { createMemoryStore } from './store.ts';

// 3x3, unique: buttons 1..4 at cells 0, 2, 6, 8.
const PATTERN: StoredPattern = {
  id: 't1',
  size: 3,
  buttons: [0, 2, 6, 8],
  seams: [],
  crosses: [],
  difficulty: 'easy',
  solution: [0, 1, 2, 5, 4, 3, 6, 7, 8],
  score: 0,
};
const LONG_ENOUGH = MIN_MS_PER_CELL * PATTERN.solution.length;

test('starting twice keeps the first start time', async () => {
  const store = createMemoryStore();
  const first = await startRun(store, 1, 'u1', 1000);
  const second = await startRun(store, 1, 'u1', 9000);
  assert.ok(first.ok && second.ok);
  assert.equal(second.run.startedAt, 1000);
});

test('a hint on a correct thread points at the next cell', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  const hint = await takeHint(store, 1, 'u1', PATTERN, [0, 1, 2], 100);
  assert.deepEqual(hint, { ok: true, keep: 3, next: 5, hintReadyAt: 100 + HINT_COOLDOWN_MS });
});

test('a hint on a wrong thread unpicks to the last correct cell first', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  const hint = await takeHint(store, 1, 'u1', PATTERN, [0, 1, 4, 3], 100);
  assert.ok(hint.ok);
  assert.equal(hint.keep, 2);
  assert.equal(hint.next, 2);
});

test('a hint with only button 1 stitched points at the first step', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  const hint = await takeHint(store, 1, 'u1', PATTERN, [0], 100);
  assert.ok(hint.ok);
  assert.equal(hint.keep, 1);
  assert.equal(hint.next, 1);
});

test('hints are refused during the 5 second cooldown, then allowed', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  assert.ok((await takeHint(store, 1, 'u1', PATTERN, [0], 1000)).ok);
  const early = await takeHint(store, 1, 'u1', PATTERN, [0, 1], 1000 + HINT_COOLDOWN_MS - 1);
  assert.deepEqual(early, { ok: false, reason: 'cooldown', hintReadyAt: 1000 + HINT_COOLDOWN_MS });
  assert.ok((await takeHint(store, 1, 'u1', PATTERN, [0, 1], 1000 + HINT_COOLDOWN_MS)).ok);
  assert.equal((await getRun(store, 1, 'u1'))?.hints, 2);
});

test('a hint needs a started, unfinished run', async () => {
  const store = createMemoryStore();
  assert.deepEqual(await takeHint(store, 1, 'u1', PATTERN, [0], 0), { ok: false, reason: 'not-started' });
  await startRun(store, 1, 'u1', 0);
  await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, LONG_ENOUGH, true);
  assert.deepEqual(await takeHint(store, 1, 'u1', PATTERN, [0], 99999), { ok: false, reason: 'finished' });
});

test('a valid thread is timed by the server and ranked', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 5000);
  const result = await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 1, 5000 + 48000, true);
  assert.deepEqual(result, {
    ok: true,
    timeMs: 48000,
    hints: 0,
    unpicks: 1,
    badge: 'no-hints-counted',
    counted: true,
    standing: { rank: 1, solvers: 1 },
  });
  assert.equal(await store.zScore(leaderboardKey(1), 'u1'), 48000);
});

test('an invalid thread is rejected and nothing is recorded', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  const wrongOrder = [0, 3, 6, 7, 4, 1, 2, 5, 8];
  assert.deepEqual(await submitRun(store, 1, 'u1', PATTERN, wrongOrder, 0, 60000, true), { ok: false, reason: 'button-order' });
  assert.equal((await submitRun(store, 1, 'u1', PATTERN, [0, 1, 2], 0, 60000, true)).ok, false);
  assert.equal(await store.zCard(leaderboardKey(1)), 0);
  assert.equal((await getRun(store, 1, 'u1'))?.finished, false);
});

test('a solve faster than 0.08 s per cell is rejected', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  assert.deepEqual(await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, LONG_ENOUGH - 1, true), {
    ok: false,
    reason: 'too-fast',
  });
  assert.equal((await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, LONG_ENOUGH, true)).ok, true);
});

test('only the first finish counts', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, 30000, true);
  const again = await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 5, 90000, true);
  assert.ok(again.ok);
  assert.equal(again.timeMs, 30000);
  assert.equal(again.unpicks, 0);
  assert.equal(await store.zScore(leaderboardKey(1), 'u1'), 30000);
});

test('a submission without a start is rejected', async () => {
  const store = createMemoryStore();
  assert.deepEqual(await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, 99999, true), {
    ok: false,
    reason: 'not-started',
  });
});

test('practice on an older post is checked but never ranked', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  const result = await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, 30000, false);
  assert.ok(result.ok);
  assert.equal(result.counted, false);
  assert.equal(await store.zCard(leaderboardKey(1)), 0);
});

test('using a hint removes the badge', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  await takeHint(store, 1, 'u1', PATTERN, [0], 10);
  const result = await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, 30000, true);
  assert.ok(result.ok);
  assert.equal(result.badge, 'none');
});

test('badges follow the SPEC table', () => {
  assert.equal(badgeFor(1, 0), 'none');
  assert.equal(badgeFor(0, 0), 'flawless');
  assert.equal(badgeFor(0, 1), 'no-hints-counted');
  assert.equal(badgeFor(0, 2), 'no-hints-counted');
  assert.equal(badgeFor(0, 3), 'no-hints');
  assert.equal(badgeLabel('no-hints-counted', 1), 'No hints · 1 unpick');
  assert.equal(badgeLabel('no-hints-counted', 2), 'No hints · 2 unpicks');
  assert.equal(badgeLabel('flawless', 0), 'Flawless');
  assert.equal(formatTime(48_999), '0:48');
  assert.equal(formatTime(125_000), '2:05');
});

test('days are numbered from 1 and each post maps to its day', async () => {
  const store = createMemoryStore();
  const rng = seeded(3);
  assert.equal(await currentDay(store), undefined);
  for (let n = 1; n <= 3; n++) {
    const next = await chooseNextPattern(store, rng);
    assert.ok(next);
    assert.equal(next.day, n);
    await recordDay(store, { day: next.day, patternId: next.pattern.id, postId: `t3_${n}`, createdAt: n });
  }
  assert.equal((await currentDay(store))?.day, 3);
  assert.equal((await dayForPost(store, 't3_2'))?.day, 2);
  assert.equal(await dayForPost(store, 't3_nope'), undefined);
});

test('the reset is at 01:00 UTC and titles use the Lagos date', () => {
  const beforeReset = Date.UTC(2026, 10, 25, 0, 30);
  assert.equal(nextResetAt(beforeReset), Date.UTC(2026, 10, 25, 1, 0));
  const afterReset = Date.UTC(2026, 10, 25, 1, 0);
  assert.equal(nextResetAt(afterReset), Date.UTC(2026, 10, 26, 1, 0));
  assert.equal(postTitle(14, Date.UTC(2026, 10, 25, 1, 0)), 'DarnIt! #14 · 25 Nov 2026');
  // 23:30 UTC is already the next day in Lagos.
  assert.equal(postTitle(15, Date.UTC(2026, 10, 25, 23, 30)), 'DarnIt! #15 · 26 Nov 2026');
});

test('standing ranks counted finishes fastest first', async () => {
  const store = createMemoryStore();
  for (const [user, ms] of [['a', 40000], ['b', 20000], ['c', 60000]] as const) {
    await startRun(store, 1, user, 0);
    await submitRun(store, 1, user, PATTERN, PATTERN.solution, 0, ms, true);
  }
  assert.deepEqual(await getStanding(store, 1, 'b'), { rank: 1, solvers: 3 });
  assert.deepEqual(await getStanding(store, 1, 'a'), { rank: 2, solvers: 3 });
  assert.deepEqual(await getStanding(store, 1, 'c'), { rank: 3, solvers: 3 });
  assert.equal(await getStanding(store, 1, 'nobody'), null);
  await startRun(store, 1, 'd', 0);
  const result = await submitRun(store, 1, 'd', PATTERN, PATTERN.solution, 0, 30000, true);
  assert.ok(result.ok);
  assert.deepEqual(result.standing, { rank: 2, solvers: 4 });
});

test('practice finishes have no standing', async () => {
  const store = createMemoryStore();
  await startRun(store, 1, 'u1', 0);
  const result = await submitRun(store, 1, 'u1', PATTERN, PATTERN.solution, 0, 30000, false);
  assert.ok(result.ok);
  assert.equal(result.standing, null);
});

test('the standing line uses rank below five solvers, percentage from five', () => {
  assert.equal(standingLine({ rank: 2, solvers: 4 }, 'DarnItGame'), '2nd of 4 today');
  assert.equal(standingLine({ rank: 1, solvers: 1 }, 'DarnItGame'), '1st of 1 today');
  assert.equal(standingLine({ rank: 2, solvers: 8 }, 'DarnItGame'), 'Faster than 75% of r/DarnItGame today');
  assert.equal(standingLine({ rank: 1, solvers: 5 }, 'DarnItGame'), 'Faster than 80% of r/DarnItGame today');
  assert.equal(standingLine({ rank: 7, solvers: 7 }, 'DarnItGame'), '7th of 7 today', 'last place never reads 0%');
});

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), [
    '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
  ]);
});

test('share text matches the SPEC example and never shows the thread', () => {
  assert.equal(
    shareText({ day: 14, timeMs: 48_500, badge: 'flawless', unpicks: 0, standing: { rank: 2, solvers: 8 }, subredditName: 'DarnItGame', streak: 12 }),
    'DarnIt! #14 · 0:48\nFaster than 75% of r/DarnItGame today\nFlawless · 12-day streak'
  );
  assert.equal(
    shareText({ day: 3, timeMs: 125_000, badge: 'none', unpicks: 4, standing: { rank: 2, solvers: 3 }, subredditName: 'DarnItGame' }),
    'DarnIt! #3 · 2:05\n2nd of 3 today'
  );
  assert.equal(
    shareText({ day: 3, timeMs: 61_000, badge: 'no-hints-counted', unpicks: 1, standing: null, subredditName: 'DarnItGame' }),
    'DarnIt! #3 · 1:01\nNo hints · 1 unpick'
  );
});

test('onboarding flags start off and only turn on', async () => {
  const { markPrefs, readPrefs } = await import('./prefs.ts');
  const store = createMemoryStore();
  assert.deepEqual(await readPrefs(store, 'u'), { tutorialDone: false, crossIntroSeen: false });
  await markPrefs(store, 'u', { tutorialDone: true });
  assert.deepEqual(await readPrefs(store, 'u'), { tutorialDone: true, crossIntroSeen: false });
  await markPrefs(store, 'u', { crossIntroSeen: true, tutorialDone: false });
  assert.deepEqual(await readPrefs(store, 'u'), { tutorialDone: true, crossIntroSeen: true });
});

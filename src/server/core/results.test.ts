import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANK } from '../bank/bank.ts';
import { recordDay } from './days.ts';
import type { Day } from './days.ts';
import { cleanCells, currentStreak, readStats, statsView } from './players.ts';
import { LEADERBOARD_SIZE, buildResults } from './results.ts';
import { startRun, submitRun } from './runs.ts';
import type { Store } from './store.ts';
import { createMemoryStore } from './store.ts';

const SLOW = 10 * 60 * 1000;

const setupDays = async (store: Store, count: number): Promise<Day[]> => {
  const days: Day[] = [];
  for (let n = 1; n <= count; n++) {
    const pattern = BANK[n - 1];
    assert.ok(pattern);
    const day: Day = { day: n, patternId: pattern.id, postId: `t3_${n}`, createdAt: n };
    await recordDay(store, day);
    days.push(day);
  }
  return days;
};

const solve = async (store: Store, day: number, userId: string, ms: number, extras = {}) => {
  const pattern = BANK[day - 1];
  assert.ok(pattern);
  await startRun(store, day, userId, 0, true);
  const result = await submitRun(store, day, userId, pattern, pattern.solution, 0, ms, true, extras);
  assert.ok(result.ok, JSON.stringify(result));
};

test('streaks count consecutive days and reset after a missed day', async () => {
  const store = createMemoryStore();
  await setupDays(store, 6);
  for (const d of [1, 2, 3]) await solve(store, d, 'u', SLOW);
  let stats = await readStats(store, 'u');
  assert.equal(stats?.streak, 3);
  assert.equal(currentStreak(stats, 3), 3);
  assert.equal(currentStreak(stats, 4), 3, 'still alive on day 4 until it is missed');
  assert.equal(currentStreak(stats, 5), 0, 'day 4 missed');
  await solve(store, 5, 'u', SLOW - 1000);
  stats = await readStats(store, 'u');
  assert.equal(stats?.streak, 1);
  assert.equal(stats?.maxStreak, 3);
  assert.equal(stats?.solves, 4);
  assert.equal(stats?.plays, 4);
  assert.equal(stats?.bestMs, SLOW - 1000);
});

test('stats show the next streak milestone', () => {
  const view = statsView(
    { firstDay: 1, plays: 5, solves: 5, bestMs: 30000, streak: 5, maxStreak: 5, lastSolvedDay: 5, days: {} },
    5
  );
  assert.deepEqual(view.nextMilestone, { days: 7, reward: 'Apprentice flair and a hoop frame', toGo: 2 });
  assert.equal(view.currentStreak, 5);
  assert.equal(statsView(undefined, 3).currentStreak, 0);
});

test('practice runs never touch stats', async () => {
  const store = createMemoryStore();
  await setupDays(store, 1);
  const pattern = BANK[0];
  assert.ok(pattern);
  await startRun(store, 1, 'u', 0, false);
  await submitRun(store, 1, 'u', pattern, pattern.solution, 0, SLOW, false);
  assert.equal(await readStats(store, 'u'), undefined);
});

test('results need a finished run', async () => {
  const store = createMemoryStore();
  const [day] = await setupDays(store, 1);
  assert.ok(day);
  assert.deepEqual(await buildResults(store, day, 'u', 'DarnItGame', 0), { ok: false, reason: 'not-finished' });
  await startRun(store, 1, 'u', 0, true);
  assert.deepEqual(await buildResults(store, day, 'u', 'DarnItGame', 0), { ok: false, reason: 'not-finished' });
});

test('the leaderboard shows the top ten and pins my row below them', async () => {
  const store = createMemoryStore();
  const [day] = await setupDays(store, 1);
  assert.ok(day);
  for (let i = 0; i < 12; i++) {
    await solve(store, 1, `p${i}`, SLOW + i * 1000, { profile: { username: `player${i}`, snoovatar: null } });
  }
  await solve(store, 1, 'me', SLOW + 50_000, { profile: { username: 'me-name', snoovatar: 'https://i.redd.it/x.png' } });
  const results = await buildResults(store, day, 'me', 'DarnItGame', 0);
  assert.ok(results.ok);
  assert.equal(results.leaderboard.top.length, LEADERBOARD_SIZE);
  assert.equal(results.leaderboard.top[0]?.username, 'player0');
  assert.equal(results.leaderboard.solvers, 13);
  assert.deepEqual(results.leaderboard.me, {
    rank: 13,
    username: 'me-name',
    snoovatar: 'https://i.redd.it/x.png',
    timeMs: SLOW + 50_000,
    badge: 'flawless',
    unpicks: 0,
    me: true,
  });
  const inside = await buildResults(store, day, 'p3', 'DarnItGame', 0);
  assert.ok(inside.ok);
  assert.equal(inside.leaderboard.me, null, 'no pinned row when already in the top ten');
  assert.equal(inside.leaderboard.top[3]?.me, true);
});

test('quilts: personal squares from the first play, sewn where solved; community shows every day', async () => {
  const store = createMemoryStore();
  const days = await setupDays(store, 4);
  await solve(store, 2, 'u', SLOW);
  await startRun(store, 3, 'u', 0, true); // played, not finished
  await solve(store, 4, 'u', SLOW);
  await solve(store, 1, 'other', SLOW);
  const day4 = days[3];
  assert.ok(day4);
  const results = await buildResults(store, day4, 'u', 'DarnItGame', 0);
  assert.ok(results.ok);
  assert.deepEqual(
    results.quilt.map((s) => [s.day, s.thread !== null]),
    [
      [2, true],
      [3, false],
      [4, true],
    ]
  );
  assert.deepEqual(
    results.community.map((s) => [s.day, s.solvers]),
    [
      [1, 1],
      [2, 1],
      [3, 0],
      [4, 1],
    ]
  );
  // Looking back from day 2, later days' threads stay hidden.
  const day2 = days[1];
  assert.ok(day2);
  const earlier = await buildResults(store, day2, 'u', 'DarnItGame', 0);
  assert.ok(earlier.ok);
  assert.equal(earlier.community[3]?.thread, null);
});

test('the heatmap counts each player once per square, and ignores bad squares', async () => {
  const store = createMemoryStore();
  const [day] = await setupDays(store, 1);
  assert.ok(day);
  const cells = (BANK[0]?.size ?? 5) ** 2;
  await solve(store, 1, 'a', SLOW, { unpickCells: [3, 3, 7] });
  await solve(store, 1, 'b', SLOW, { unpickCells: [3, -1, 9999, 'x'] });
  const results = await buildResults(store, day, 'a', 'DarnItGame', 0);
  assert.ok(results.ok);
  assert.equal(results.heatmap.counts.length, cells);
  assert.equal(results.heatmap.counts[3], 2);
  assert.equal(results.heatmap.counts[7], 1);
  assert.equal(results.heatmap.players, 2);
  assert.deepEqual(cleanCells([1, 1, 2.5, 4, 'z', 30], 25), [1, 4]);
});

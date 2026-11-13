// Runs the real server routes inside the page: any fetch to /api/ is answered by the same
// Hono router the Devvit server uses, backed by the in-memory store.

import { Hono } from 'hono';
import { BANK } from '../server/bank/bank.ts';
import { currentDay, listDays, recordDay } from '../server/core/days.ts';
import type { Day } from '../server/core/days.ts';
import { addHeat, saveProfile } from '../server/core/players.ts';
import { leaderboardKey } from '../server/core/runs.ts';
import { api } from '../server/routes/api.ts';
import type { Difficulty, StoredPattern } from '../shared/puzzle/pattern.ts';
import { context, redis } from './devvit-server.ts';

const app = new Hono();
app.route('/api', api);

const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api/')) return Promise.resolve(app.fetch(new Request(`http://preview.local${url}`, init)));
  return realFetch(input, init);
};

/**
 * Test page only: six sample players with times, badges and wrong turns, so every part of
 * the Results page has something to show. The real game never invents players.
 */
const seedSamples = async (day: number, pattern: StoredPattern): Promise<void> => {
  const times = [41, 58, 73, 96, 132, 214];
  for (let i = 0; i < times.length; i++) {
    const userId = `t2_sample${i}`;
    const ms = (times[i] ?? 60) * 1000;
    await redis.zAdd(leaderboardKey(day), { member: userId, score: ms });
    await saveProfile(redis, userId, { username: `sample-stitcher-${i + 1}`, snoovatar: null });
    const unpicks = i % 3;
    await redis.set(
      `run:${day}:${userId}`,
      JSON.stringify({ startedAt: 0, finishedAt: ms, timeMs: ms, hints: i === 5 ? 1 : 0, unpicks, lastHintAt: 0 })
    );
    // Wrong turns cluster round the middle of the thread, like real ones would.
    const mid = pattern.solution[Math.floor(pattern.solution.length / 2) + (i % 2)];
    const other = pattern.solution[Math.floor(pattern.solution.length / 3)];
    await addHeat(redis, day, unpicks > 0 ? [mid ?? 0, ...(i % 2 ? [other ?? 0] : [])] : []);
  }
};

const open = async (pattern: StoredPattern): Promise<Day> => {
  const days = await listDays(redis);
  const day: Day = { day: days.length + 1, patternId: pattern.id, postId: `t3_preview${days.length + 1}`, createdAt: Date.now() };
  await recordDay(redis, day);
  await seedSamples(day.day, pattern);
  context.postId = day.postId;
  return day;
};

/** Move the preview on to a fresh pattern, optionally of a chosen difficulty. */
export const nextPattern = async (difficulty?: Difficulty): Promise<Day> => {
  const used = new Set((await listDays(redis)).map((d) => d.patternId));
  let pool = BANK.filter((p) => !used.has(p.id) && (!difficulty || p.difficulty === difficulty));
  // Once a tier has been played through, start it again.
  if (pool.length === 0) pool = BANK.filter((p) => !difficulty || p.difficulty === difficulty);
  const pattern = pool[Math.floor(Math.random() * pool.length)] ?? BANK[0];
  if (!pattern) throw new Error('the pattern bank is empty');
  return open(pattern);
};

export const ensureDay = async (): Promise<Day> => {
  const day = await currentDay(redis);
  if (day) {
    context.postId = day.postId;
    return day;
  }
  return nextPattern('easy');
};

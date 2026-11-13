// Runs the real server routes inside the page: any fetch to /api/ is answered by the same
// Hono router the Devvit server uses, backed by the in-memory store.

import { Hono } from 'hono';
import { BANK } from '../server/bank/bank.ts';
import { currentDay, listDays, recordDay } from '../server/core/days.ts';
import type { Day } from '../server/core/days.ts';
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

const open = async (pattern: StoredPattern): Promise<Day> => {
  const days = await listDays(redis);
  const day: Day = { day: days.length + 1, patternId: pattern.id, postId: `t3_preview${days.length + 1}`, createdAt: Date.now() };
  await recordDay(redis, day);
  // Test page only: six sample solve times so the result card's standing line shows.
  // The real game never invents players.
  const sample = [41, 58, 73, 96, 132, 214].map((s, i) => ({ member: `t2_sample${i}`, score: s * 1000 }));
  await redis.zAdd(leaderboardKey(day.day), ...sample);
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

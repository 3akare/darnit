// Client-facing API. Thin on purpose: the rules live in ../core.

import { context, redis } from '@devvit/web/server';
import { Hono } from 'hono';
import type {
  HintRequest,
  HintResponse,
  ResultsResponse,
  StartResponse,
  SubmitRequest,
  SubmitResponse,
  TodayResponse,
} from '../../shared/api.ts';
import { toPublic } from '../../shared/puzzle/pattern.ts';
import { currentDay, dayForPost, nextResetAt, patternForDay } from '../core/days.ts';
import { buildResults } from '../core/results.ts';
import { getRun, getStanding, leaderboardKey, startRun, submitRun, takeHint } from '../core/runs.ts';

export const api = new Hono();

/** The day and pattern behind the post this request came from. */
const resolve = async () => {
  const { postId } = context;
  if (!postId) return undefined;
  const day = await dayForPost(redis, postId);
  if (!day) return undefined;
  const pattern = patternForDay(day);
  if (!pattern) return undefined;
  const today = await currentDay(redis);
  return { day, pattern, isToday: today?.day === day.day };
};

api.get('/today', async (c) => {
  const found = await resolve();
  if (!found) return c.json({ status: 'error', message: 'No pattern is attached to this post.' }, 404);
  const now = Date.now();
  const body: TodayResponse = {
    day: found.day.day,
    pattern: toPublic(found.pattern),
    isToday: found.isToday,
    username: context.username ?? null,
    subredditName: context.subredditName,
    run: context.userId ? await getRun(redis, found.day.day, context.userId) : null,
    standing: context.userId && found.isToday ? await getStanding(redis, found.day.day, context.userId) : null,
    solvers: await redis.zCard(leaderboardKey(found.day.day)),
    postId: found.day.postId,
    serverNow: now,
    nextResetAt: nextResetAt(now),
  };
  return c.json(body);
});

api.post('/start', async (c) => {
  const found = await resolve();
  if (!found) return c.json<StartResponse>({ ok: false, reason: 'no-pattern' });
  if (!context.userId) return c.json<StartResponse>({ ok: false, reason: 'logged-out' });
  return c.json<StartResponse>(await startRun(redis, found.day.day, context.userId, Date.now(), found.isToday));
});

api.post('/hint', async (c) => {
  const found = await resolve();
  if (!found) return c.json<HintResponse>({ ok: false, reason: 'no-pattern' });
  if (!context.userId) return c.json<HintResponse>({ ok: false, reason: 'logged-out' });
  const { thread } = await c.req.json<HintRequest>();
  return c.json<HintResponse>(
    await takeHint(redis, found.day.day, context.userId, found.pattern, Array.isArray(thread) ? thread : [], Date.now())
  );
});

api.post('/submit', async (c) => {
  const found = await resolve();
  if (!found) return c.json<SubmitResponse>({ ok: false, reason: 'no-pattern' });
  if (!context.userId) return c.json<SubmitResponse>({ ok: false, reason: 'logged-out' });
  const { thread, unpicks, unpickCells } = await c.req.json<SubmitRequest>();
  return c.json<SubmitResponse>(
    await submitRun(
      redis,
      found.day.day,
      context.userId,
      found.pattern,
      Array.isArray(thread) ? thread : [],
      unpicks,
      Date.now(),
      found.isToday,
      {
        profile: { username: context.username ?? 'someone', snoovatar: context.snoovatar ?? null },
        unpickCells,
      }
    )
  );
});

api.get('/results', async (c) => {
  const found = await resolve();
  if (!found) return c.json<ResultsResponse>({ ok: false, reason: 'no-pattern' });
  if (!context.userId) return c.json<ResultsResponse>({ ok: false, reason: 'logged-out' });
  return c.json<ResultsResponse>(await buildResults(redis, found.day, context.userId, context.subredditName, Date.now()));
});

// A player's run on one day's pattern: the server stamps the start and the finish, gives
// hints one step at a time, and checks every submitted thread against the rules.

import { HINT_COOLDOWN_MS, badgeFor } from '../../shared/api.ts';
import type { HintResponse, RunView, Standing, StartResponse, SubmitResponse } from '../../shared/api.ts';
import { checkThread, compile } from '../../shared/puzzle/pattern.ts';
import type { StoredPattern } from '../../shared/puzzle/pattern.ts';
import type { Store } from './store.ts';

type Run = {
  startedAt: number;
  finishedAt: number | null;
  timeMs: number | null;
  hints: number;
  unpicks: number | null;
  lastHintAt: number;
};

/** SPEC anti-cheat: nobody stitches faster than 0.08 s per cell. */
export const MIN_MS_PER_CELL = 80;

const runKey = (day: number, userId: string): string => `run:${day}:${userId}`;
export const leaderboardKey = (day: number): string => `lb:${day}`;

const readRun = async (store: Store, day: number, userId: string): Promise<Run | undefined> => {
  const raw = await store.get(runKey(day, userId));
  return raw ? JSON.parse(raw) : undefined;
};

const writeRun = (store: Store, day: number, userId: string, run: Run): Promise<unknown> =>
  store.set(runKey(day, userId), JSON.stringify(run));

const view = (run: Run): RunView => ({
  startedAt: run.startedAt,
  finished: run.finishedAt !== null,
  timeMs: run.timeMs,
  hints: run.hints,
  unpicks: run.unpicks,
  hintReadyAt: run.lastHintAt ? run.lastHintAt + HINT_COOLDOWN_MS : 0,
});

/** Rank among today's counted solvers, fastest first, or null without a counted finish. */
export const getStanding = async (store: Store, day: number, userId: string): Promise<Standing | null> => {
  const position = await store.zRank(leaderboardKey(day), userId);
  if (position === undefined) return null;
  return { rank: position + 1, solvers: await store.zCard(leaderboardKey(day)) };
};

export const getRun = async (store: Store, day: number, userId: string): Promise<RunView | null> => {
  const run = await readRun(store, day, userId);
  return run ? view(run) : null;
};

/** The first stitch. Starting twice keeps the first start time. */
export const startRun = async (store: Store, day: number, userId: string, now: number): Promise<StartResponse> => {
  const existing = await readRun(store, day, userId);
  if (existing) return { ok: true, run: view(existing) };
  const run: Run = { startedAt: now, finishedAt: null, timeMs: null, hints: 0, unpicks: null, lastHintAt: 0 };
  await writeRun(store, day, userId, run);
  return { ok: true, run: view(run) };
};

/**
 * One hint: how much of the thread is right, and the next right cell. The solution itself
 * never leaves the server.
 */
export const takeHint = async (
  store: Store,
  day: number,
  userId: string,
  pattern: StoredPattern,
  thread: readonly number[],
  now: number
): Promise<HintResponse> => {
  const run = await readRun(store, day, userId);
  if (!run) return { ok: false, reason: 'not-started' };
  if (run.finishedAt !== null) return { ok: false, reason: 'finished' };
  const readyAt = run.lastHintAt + HINT_COOLDOWN_MS;
  if (run.lastHintAt && now < readyAt) return { ok: false, reason: 'cooldown', hintReadyAt: readyAt };

  let keep = 0;
  while (keep < thread.length && keep < pattern.solution.length && thread[keep] === pattern.solution[keep]) keep += 1;
  // The thread always holds button 1, and a full correct thread would already be solved.
  keep = Math.max(1, Math.min(keep, pattern.solution.length - 1));
  const next = pattern.solution[keep] ?? pattern.solution[0] ?? 0;

  run.hints += 1;
  run.lastHintAt = now;
  await writeRun(store, day, userId, run);
  return { ok: true, keep, next, hintReadyAt: now + HINT_COOLDOWN_MS };
};

/**
 * A finished thread. Checked against the rules, not against the stored solution: every
 * pattern has one solution, so any valid fill is it. Only the first finish counts.
 */
export const submitRun = async (
  store: Store,
  day: number,
  userId: string,
  pattern: StoredPattern,
  thread: readonly number[],
  unpicks: number,
  now: number,
  /** False on an older post: the run is checked and timed but never ranked. */
  counted: boolean
): Promise<SubmitResponse> => {
  const run = await readRun(store, day, userId);
  if (!run) return { ok: false, reason: 'not-started' };
  if (run.finishedAt !== null && run.timeMs !== null) {
    const kept = run.unpicks ?? 0;
    return {
      ok: true,
      timeMs: run.timeMs,
      hints: run.hints,
      unpicks: kept,
      badge: badgeFor(run.hints, kept),
      counted,
      standing: counted ? await getStanding(store, day, userId) : null,
    };
  }
  const verdict = checkThread(compile(pattern), thread);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const timeMs = now - run.startedAt;
  if (timeMs < MIN_MS_PER_CELL * pattern.solution.length) return { ok: false, reason: 'too-fast' };

  const cleanUnpicks = Number.isInteger(unpicks) && unpicks >= 0 ? unpicks : 0;
  run.finishedAt = now;
  run.timeMs = timeMs;
  run.unpicks = cleanUnpicks;
  await writeRun(store, day, userId, run);
  if (counted) await store.zAdd(leaderboardKey(day), { member: userId, score: timeMs });
  return {
    ok: true,
    timeMs,
    hints: run.hints,
    unpicks: cleanUnpicks,
    badge: badgeFor(run.hints, cleanUnpicks),
    counted,
    standing: counted ? await getStanding(store, day, userId) : null,
  };
};

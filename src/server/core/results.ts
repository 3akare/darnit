// Everything on the Results page, gathered in one call: leaderboard, stats, both quilts and
// the wrong-turn heatmap. Only a player who has finished the day's pattern can ask for it,
// because the community quilt and the heatmap give the day's thread away.

import { badgeFor } from '../../shared/api.ts';
import type { LeaderRow, QuiltSquare, ResultsResponse } from '../../shared/api.ts';
import { toPublic } from '../../shared/puzzle/pattern.ts';
import { getPattern } from '../bank/bank.ts';
import { listDays, nextResetAt } from './days.ts';
import type { Day } from './days.ts';
import { readHeat, readProfile, readStats, statsView } from './players.ts';
import { leaderboardKey, readRun } from './runs.ts';
import type { Store } from './store.ts';

export const LEADERBOARD_SIZE = 10;

const row = async (store: Store, day: number, member: string, score: number, rank: number, me: string): Promise<LeaderRow> => {
  const [profile, run] = await Promise.all([readProfile(store, member), readRun(store, day, member)]);
  const unpicks = run?.unpicks ?? 0;
  return {
    rank,
    username: profile?.username ?? 'someone',
    snoovatar: profile?.snoovatar ?? null,
    timeMs: score,
    badge: badgeFor(run?.hints ?? 0, unpicks),
    unpicks,
    me: member === me,
  };
};

export const buildResults = async (
  store: Store,
  day: Day,
  userId: string,
  subredditName: string,
  now: number
): Promise<ResultsResponse> => {
  const pattern = getPattern(day.patternId);
  if (!pattern) return { ok: false, reason: 'no-pattern' };
  const run = await readRun(store, day.day, userId);
  if (!run || run.finishedAt === null) return { ok: false, reason: 'not-finished' };

  const lb = leaderboardKey(day.day);
  const [topRaw, solvers, myRank] = await Promise.all([
    store.zRange(lb, 0, LEADERBOARD_SIZE - 1),
    store.zCard(lb),
    store.zRank(lb, userId),
  ]);
  const top = await Promise.all(topRaw.map((m, i) => row(store, day.day, m.member, m.score, i + 1, userId)));
  let me: LeaderRow | null = null;
  if (myRank !== undefined && myRank >= LEADERBOARD_SIZE) {
    const score = await store.zScore(lb, userId);
    if (score !== undefined) me = await row(store, day.day, userId, score, myRank + 1, userId);
  }

  const days = await listDays(store);
  const latest = days[days.length - 1]?.day ?? day.day;
  const stats = await readStats(store, userId);

  // Personal quilt: one square per day since the first play, sewn where solved.
  const quilt: QuiltSquare[] = [];
  const firstDay = stats?.firstDay ?? day.day;
  for (const d of days) {
    if (d.day < firstDay) continue;
    const p = getPattern(d.patternId);
    if (!p) continue;
    const record = stats?.days[d.day];
    quilt.push({
      day: d.day,
      size: p.size,
      difficulty: p.difficulty,
      thread: record ? p.solution : null,
      timeMs: record?.timeMs ?? null,
      badge: record?.badge ?? null,
      unpicks: record?.unpicks ?? 0,
      solvers: 0,
    });
  }

  // Community quilt: every day since launch, sewn in its difficulty's colour.
  const community: QuiltSquare[] = await Promise.all(
    days.map(async (d) => {
      const p = getPattern(d.patternId);
      return {
        day: d.day,
        size: p?.size ?? 5,
        difficulty: p?.difficulty ?? 'easy',
        // A later day's thread stays hidden; this player has only finished up to this one.
        thread: p && d.day <= day.day ? p.solution : null,
        timeMs: null,
        badge: null,
        unpicks: 0,
        solvers: await store.zCard(leaderboardKey(d.day)),
      };
    })
  );

  return {
    ok: true,
    day: day.day,
    subredditName,
    pattern: toPublic(pattern),
    leaderboard: { top, me, solvers },
    stats: statsView(stats, latest),
    quilt,
    community,
    heatmap: { counts: await readHeat(store, day.day, pattern.size * pattern.size), players: solvers },
    solution: pattern.solution,
    serverNow: now,
    nextResetAt: nextResetAt(now),
  };
};

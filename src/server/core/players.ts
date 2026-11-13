// Per-player records: the name and avatar shown on the leaderboard, play stats and streaks,
// and the day's wrong-turn counts. Only counted runs (today's pattern) touch any of this.

import type { Badge, Stats } from '../../shared/api.ts';
import type { Store } from './store.ts';

export type Profile = { username: string; snoovatar: string | null };

export type DayRecord = { timeMs: number; badge: Badge; unpicks: number };

export type PlayerStats = {
  /** First day number the player started a counted run. */
  firstDay: number;
  plays: number;
  solves: number;
  bestMs: number | null;
  /** Streak as of lastSolvedDay. Read it through statsView, which drops it after a missed day. */
  streak: number;
  maxStreak: number;
  lastSolvedDay: number;
  days: Record<string, DayRecord>;
};

const profileKey = (userId: string): string => `profile:${userId}`;
const statsKey = (userId: string): string => `stats:${userId}`;
export const heatKey = (day: number): string => `heat:${day}`;

export const saveProfile = (store: Store, userId: string, profile: Profile): Promise<unknown> =>
  store.set(profileKey(userId), JSON.stringify(profile));

export const readProfile = async (store: Store, userId: string): Promise<Profile | undefined> => {
  const raw = await store.get(profileKey(userId));
  return raw ? JSON.parse(raw) : undefined;
};

export const readStats = async (store: Store, userId: string): Promise<PlayerStats | undefined> => {
  const raw = await store.get(statsKey(userId));
  return raw ? JSON.parse(raw) : undefined;
};

const writeStats = (store: Store, userId: string, stats: PlayerStats): Promise<unknown> =>
  store.set(statsKey(userId), JSON.stringify(stats));

const fresh = (day: number): PlayerStats => ({
  firstDay: day,
  plays: 0,
  solves: 0,
  bestMs: null,
  streak: 0,
  maxStreak: 0,
  lastSolvedDay: 0,
  days: {},
});

/** The first stitch on today's pattern. */
export const notePlay = async (store: Store, day: number, userId: string): Promise<void> => {
  const stats = (await readStats(store, userId)) ?? fresh(day);
  stats.plays += 1;
  stats.firstDay = Math.min(stats.firstDay, day);
  await writeStats(store, userId, stats);
};

/** The first counted finish on today's pattern. Days are consecutive post numbers. */
export const noteSolve = async (store: Store, day: number, userId: string, record: DayRecord): Promise<void> => {
  const stats = (await readStats(store, userId)) ?? fresh(day);
  if (stats.days[day]) return;
  stats.days[day] = record;
  stats.solves += 1;
  stats.bestMs = stats.bestMs === null ? record.timeMs : Math.min(stats.bestMs, record.timeMs);
  stats.streak = stats.lastSolvedDay === day - 1 ? stats.streak + 1 : 1;
  stats.lastSolvedDay = day;
  stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
  stats.firstDay = Math.min(stats.firstDay, day);
  await writeStats(store, userId, stats);
};

/** SPEC "Streaks, flair and quilts". */
export const MILESTONES: { days: number; reward: string }[] = [
  { days: 3, reward: 'a new thread colour' },
  { days: 7, reward: 'Apprentice flair and a hoop frame' },
  { days: 30, reward: 'Journeyman flair and another thread colour' },
  { days: 50, reward: 'Master flair and gold thread' },
  { days: 100, reward: 'Grand Master flair and a gold quilt border' },
];

/** The current streak as of `currentDay`: it survives until a whole day is missed. */
export const currentStreak = (stats: PlayerStats | undefined, currentDay: number): number =>
  stats && stats.lastSolvedDay >= currentDay - 1 ? stats.streak : 0;

export const statsView = (stats: PlayerStats | undefined, currentDay: number): Stats => {
  const streak = currentStreak(stats, currentDay);
  const next = MILESTONES.find((m) => m.days > streak);
  return {
    plays: stats?.plays ?? 0,
    solves: stats?.solves ?? 0,
    bestMs: stats?.bestMs ?? null,
    currentStreak: streak,
    maxStreak: stats?.maxStreak ?? 0,
    nextMilestone: next ? { days: next.days, reward: next.reward, toGo: next.days - streak } : null,
  };
};

/** Count, once per player, each square a player unpicked back to on the way to solving. */
export const addHeat = async (store: Store, day: number, cells: readonly number[]): Promise<void> => {
  for (const cell of cells) await store.hIncrBy(heatKey(day), String(cell), 1);
};

export const readHeat = async (store: Store, day: number, cellCount: number): Promise<number[]> => {
  const raw = await store.hGetAll(heatKey(day));
  const counts = new Array<number>(cellCount).fill(0);
  for (const [field, value] of Object.entries(raw)) {
    const cell = Number(field);
    if (Number.isInteger(cell) && cell >= 0 && cell < cellCount) counts[cell] = Number(value) || 0;
  }
  return counts;
};

/** Distinct, in-range squares only: the client's list is never trusted as sent. */
export const cleanCells = (cells: unknown, cellCount: number): number[] => {
  if (!Array.isArray(cells)) return [];
  const out = new Set<number>();
  for (const c of cells) {
    if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < cellCount) out.add(c);
    if (out.size >= cellCount) break;
  }
  return [...out];
};

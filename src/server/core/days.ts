// Which pattern runs on which day. A "day" is one daily post: day 14 is "DarnIt! #14".

import type { StoredPattern } from '../../shared/puzzle/pattern.ts';
import type { Rng } from '../../shared/puzzle/rng.ts';
import { getPattern, pickDaily } from '../bank/bank.ts';
import type { Store } from './store.ts';

export type Day = {
  day: number;
  patternId: string;
  postId: string;
  createdAt: number;
};

const KEY = {
  /** JSON array of every Day so far, oldest first. Sixty short entries at most. */
  days: 'days',
  post: (postId: string) => `post:${postId}`,
};

export const listDays = async (store: Store): Promise<Day[]> => {
  const raw = await store.get(KEY.days);
  return raw ? JSON.parse(raw) : [];
};

export const currentDay = async (store: Store): Promise<Day | undefined> => {
  const days = await listDays(store);
  return days[days.length - 1];
};

export const dayForPost = async (store: Store, postId: string): Promise<Day | undefined> => {
  const number = await store.get(KEY.post(postId));
  if (!number) return undefined;
  const days = await listDays(store);
  return days.find((d) => d.day === Number(number));
};

/** Pick the next pattern without recording anything, so the post can be created first. */
export const chooseNextPattern = async (store: Store, rng: Rng): Promise<{ day: number; pattern: StoredPattern } | undefined> => {
  const days = await listDays(store);
  const pattern = pickDaily(rng, days.map((d) => d.patternId));
  if (!pattern) return undefined;
  return { day: days.length + 1, pattern };
};

/** Record that `postId` is the post for the given day and pattern. */
export const recordDay = async (store: Store, entry: Day): Promise<void> => {
  const days = await listDays(store);
  days.push(entry);
  await store.set(KEY.days, JSON.stringify(days));
  await store.set(KEY.post(entry.postId), String(entry.day));
};

export const patternForDay = (day: Day): StoredPattern | undefined => getPattern(day.patternId);

/** The daily reset: 01:00 UTC, which is 02:00 in Lagos. */
export const RESET_HOUR_UTC = 1;

export const nextResetAt = (now: number): number => {
  const d = new Date(now);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), RESET_HOUR_UTC);
  return now < today ? today : today + 24 * 60 * 60 * 1000;
};

/** "DarnIt! #14 · 25 Nov 2026", dated by the Lagos day the pattern goes live on. */
export const postTitle = (day: number, now: number): string => {
  const date = new Date(now).toLocaleDateString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `DarnIt! #${day} · ${date}`;
};

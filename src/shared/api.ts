// Request and response shapes shared by the client and the server.

import type { Difficulty, Pattern } from './puzzle/pattern.ts';

export type Badge = 'flawless' | 'no-hints-counted' | 'no-hints' | 'none';

/** A player's run on one day's pattern, as the client may see it. */
export type RunView = {
  startedAt: number | null;
  finished: boolean;
  timeMs: number | null;
  hints: number;
  unpicks: number | null;
  /** When the next hint is allowed, in server time. */
  hintReadyAt: number;
};

/** Onboarding flags, kept per player. */
export type Prefs = { tutorialDone: boolean; crossIntroSeen: boolean };

/** Where a finished run places among today's solvers. */
export type Standing = { rank: number; solvers: number };

export type TodayResponse = {
  /** Pattern number, as in "DarnIt! #14". */
  day: number;
  pattern: Pattern;
  /** False on an older post: playable for practice, never counted. */
  isToday: boolean;
  username: string | null;
  subredditName: string;
  run: RunView | null;
  /** Set once the player has a counted finish today. */
  standing: Standing | null;
  /** How many have solved this day's pattern. */
  solvers: number;
  postId: string;
  /** Null when logged out; the client then keeps the flags on the device. */
  prefs: Prefs | null;
  serverNow: number;
  nextResetAt: number;
};

export type StartResponse = { ok: true; run: RunView } | { ok: false; reason: string };

export type HintRequest = { thread: number[] };
export type HintResponse =
  | {
      ok: true;
      /** How many cells of the thread are correct. Unpick back to this length. */
      keep: number;
      /** The next correct cell to stitch. */
      next: number;
      hintReadyAt: number;
    }
  | { ok: false; reason: 'cooldown' | 'not-started' | 'finished' | 'logged-out' | 'no-pattern'; hintReadyAt?: number };

export type SubmitRequest = {
  thread: number[];
  unpicks: number;
  /** Squares the player unpicked back to, for the wrong-turn heatmap. */
  unpickCells: number[];
};
export type SubmitResponse =
  | { ok: true; timeMs: number; hints: number; unpicks: number; badge: Badge; counted: boolean; standing: Standing | null }
  | { ok: false; reason: string };

export const HINT_COOLDOWN_MS = 5000;

/** SPEC "Scoring, badges and leaderboard". Rank is by time only; the badge describes the solve. */
export const badgeFor = (hints: number, unpicks: number): Badge => {
  if (hints > 0) return 'none';
  if (unpicks === 0) return 'flawless';
  if (unpicks <= 2) return 'no-hints-counted';
  return 'no-hints';
};

export const badgeLabel = (badge: Badge, unpicks: number): string => {
  if (badge === 'flawless') return 'Flawless';
  if (badge === 'no-hints-counted') return `No hints · ${unpicks} ${unpicks === 1 ? 'unpick' : 'unpicks'}`;
  if (badge === 'no-hints') return 'No hints';
  return '';
};

export const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st ... */
export const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${n % 10 > 3 ? 'th' : suffix}`;
};

/** Below this many solvers a percentage means little, so the line gives the rank instead. */
export const PERCENTILE_FROM = 5;

/**
 * SPEC "Scoring, badges and leaderboard": "Faster than 75% of r/DarnItGame today", or
 * "2nd of 4 today" while fewer than five have solved. Last place also gets the rank form,
 * since "faster than 0%" reads badly.
 */
export const standingLine = (standing: Standing, subredditName: string): string => {
  const { rank, solvers } = standing;
  const faster = Math.round((100 * (solvers - rank)) / solvers);
  if (solvers < PERCENTILE_FROM || faster <= 0) return `${ordinal(rank)} of ${solvers} today`;
  return `Faster than ${faster}% of r/${subredditName} today`;
};

/** The copyable share text. It never shows the thread, so it cannot spoil the pattern. */
export const shareText = (input: {
  day: number;
  timeMs: number;
  badge: Badge;
  unpicks: number;
  standing: Standing | null;
  subredditName: string;
  /** Current streak in days, once streaks exist. */
  streak?: number;
}): string => {
  const lines = [`DarnIt! #${input.day} · ${formatTime(input.timeMs)}`];
  if (input.standing) lines.push(standingLine(input.standing, input.subredditName));
  const last = [badgeLabel(input.badge, input.unpicks), input.streak ? `${input.streak}-day streak` : '']
    .filter(Boolean)
    .join(' · ');
  if (last) lines.push(last);
  return lines.join('\n');
};

export type LeaderRow = {
  rank: number;
  username: string;
  snoovatar: string | null;
  timeMs: number;
  badge: Badge;
  unpicks: number;
  me: boolean;
};

export type Stats = {
  plays: number;
  solves: number;
  bestMs: number | null;
  currentStreak: number;
  maxStreak: number;
  nextMilestone: { days: number; reward: string; toGo: number } | null;
};

/** One quilt square: a day's pattern, sewn if solved (personal) or always (community). */
export type QuiltSquare = {
  day: number;
  size: number;
  difficulty: Difficulty;
  /** The thread to sew on the square, or null for plain fabric. */
  thread: number[] | null;
  timeMs: number | null;
  badge: Badge | null;
  unpicks: number;
  solvers: number;
};

export type ResultsResponse =
  | {
      ok: true;
      day: number;
      subredditName: string;
      pattern: Pattern;
      leaderboard: { top: LeaderRow[]; me: LeaderRow | null; solvers: number };
      stats: Stats;
      quilt: QuiltSquare[];
      community: QuiltSquare[];
      /** Players who unpicked back to each square today, and how many solved. */
      heatmap: { counts: number[]; players: number };
      serverNow: number;
      nextResetAt: number;
    }
  | { ok: false; reason: 'not-finished' | 'logged-out' | 'no-pattern' };

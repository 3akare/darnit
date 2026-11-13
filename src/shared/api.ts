// Request and response shapes shared by the client and the server.

import type { Pattern } from './puzzle/pattern.ts';

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

export type TodayResponse = {
  /** Pattern number, as in "DarnIt! #14". */
  day: number;
  pattern: Pattern;
  /** False on an older post: playable for practice, never counted. */
  isToday: boolean;
  username: string | null;
  run: RunView | null;
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

export type SubmitRequest = { thread: number[]; unpicks: number };
export type SubmitResponse =
  | { ok: true; timeMs: number; hints: number; unpicks: number; badge: Badge; counted: boolean }
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

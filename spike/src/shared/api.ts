// Shared request/response shapes for the throwaway Day-1 spike app.

export type SpikeId =
  | 'render'
  | 'clipboard'
  | 'drag'
  | 'scheduler'
  | 'flair'
  | 'comment'
  | 'font'
  | 'notifications'
  | 'snoovatar';

export type Outcome = 'pass' | 'fail' | 'info';

export type ReportRequest = {
  spike: SpikeId;
  platform: string;
  outcome: Outcome;
  /** Free-form evidence: which method worked, fps numbers, error text. */
  detail: string;
};

export type ActionResult = {
  ok: boolean;
  /** Human-readable summary shown on the card. */
  message: string;
  /** Raw evidence, logged and shown in small print. */
  detail?: string;
};

export type SchedulerStatus = {
  serverNow: number;
  /** Every-minute cron: how many ms past the minute boundary each run fired. */
  tickLatenessMs: number[];
  tickCount: number;
  cronPosts: {
    slot: string;
    firedAt: number;
    lateMs: number;
    postId: string;
  }[];
  oneOffs: { runAt: number; firedAt: number; lateMs: number }[];
};

export type InitResponse = {
  username: string | null;
  userId: string | null;
  postId: string | null;
  subredditName: string;
  appVersion: string;
  /** context.snoovatar (experimental, current user only). */
  contextSnoovatar: string | null;
  /** reddit.getSnoovatarUrl(username): works for any username. */
  apiSnoovatar: string | null;
  apiSnoovatarError: string | null;
  serverNow: number;
  scheduler: SchedulerStatus;
};

export type FlairRequest = { action: 'set' | 'remove' };
export type CommentRequest = { mode: 'top' | 'reply'; text: string };
export type NotifyRequest = { action: 'optin' | 'optout' | 'status' | 'send' | 'badge' };
export type OneOffRequest = { delaySeconds: number };

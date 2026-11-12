// Throwaway Day-1 spike server. One file on purpose: none of this ships.
// Every outcome is logged as a single `SPIKE {...}` line so results can be read
// back with `npx devvit logs <subreddit>`.

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import {
  context,
  createServer,
  getServerPort,
  notifications,
  reddit,
  redis,
  scheduler,
} from '@devvit/web/server';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import type {
  ActionResult,
  CommentRequest,
  FlairRequest,
  InitResponse,
  NotifyRequest,
  OneOffRequest,
  ReportRequest,
  SchedulerStatus,
} from '../shared/api';

const KEY = {
  ticks: 'spike:ticks',
  cronPosts: 'spike:cronposts',
  oneOffs: 'spike:oneoffs',
  posts: 'spike:posts',
  results: 'spike:results',
  pinned: (postId: string) => `spike:pinned:${postId}`,
};

const FLAIR_TEXT = 'Apprentice · 7';

const errText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const log = (spike: string, payload: Record<string, unknown>): void => {
  console.log(
    `SPIKE ${JSON.stringify({ spike, user: context.username ?? null, ...payload })}`
  );
};

const utcStamp = (ms: number): string =>
  new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC');

const createSpikePost = async (title: string) => {
  const post = await reddit.submitCustomPost({ title });
  await redis.zAdd(KEY.posts, { member: post.id, score: Date.now() });
  return post;
};

const schedulerStatus = async (): Promise<SchedulerStatus> => {
  const [ticks, cronPosts, oneOffs] = await Promise.all([
    redis.zRange(KEY.ticks, 0, -1),
    redis.zRange(KEY.cronPosts, 0, -1),
    redis.zRange(KEY.oneOffs, 0, -1),
  ]);
  return {
    serverNow: Date.now(),
    tickCount: ticks.length,
    tickLatenessMs: ticks.map((t) => t.score % 60_000),
    cronPosts: cronPosts.map((p) => JSON.parse(p.member)),
    oneOffs: oneOffs.map((o) => JSON.parse(o.member)),
  };
};

const app = new Hono();
const api = new Hono();
const internal = new Hono();

// ---------------------------------------------------------------- client API

api.get('/init', async (c) => {
  const username = context.username ?? (await reddit.getCurrentUsername()) ?? null;
  let apiSnoovatar: string | null = null;
  let apiSnoovatarError: string | null = null;
  if (username) {
    try {
      apiSnoovatar = (await reddit.getSnoovatarUrl(username)) ?? null;
    } catch (error) {
      apiSnoovatarError = errText(error);
    }
  }
  const body: InitResponse = {
    username,
    userId: context.userId ?? null,
    postId: context.postId ?? null,
    subredditName: context.subredditName,
    appVersion: context.appVersion,
    contextSnoovatar: context.snoovatar ?? null,
    apiSnoovatar,
    apiSnoovatarError,
    serverNow: Date.now(),
    scheduler: await schedulerStatus(),
  };
  log('init', {
    postId: body.postId,
    hasContextSnoovatar: Boolean(body.contextSnoovatar),
    hasApiSnoovatar: Boolean(apiSnoovatar),
    apiSnoovatarError,
  });
  return c.json(body);
});

api.post('/report', async (c) => {
  const report = await c.req.json<ReportRequest>();
  const field = `${report.spike}|${report.platform}|${context.username ?? 'anon'}`;
  await redis.hSet(KEY.results, {
    [field]: JSON.stringify({ ...report, at: Date.now() }),
  });
  log('report', report);
  return c.json({ ok: true });
});

api.get('/results', async (c) => {
  const all = await redis.hGetAll(KEY.results);
  return c.json(Object.values(all).map((v) => JSON.parse(v)));
});

api.get('/scheduler', async (c) => c.json(await schedulerStatus()));

api.post('/scheduler/one-off', async (c) => {
  const { delaySeconds } = await c.req.json<OneOffRequest>();
  const delay = Math.min(Math.max(delaySeconds, 10), 600);
  const runAt = new Date(Date.now() + delay * 1000);
  try {
    const jobId = await scheduler.runJob({
      name: 'one-off',
      data: { runAt: runAt.getTime() },
      runAt,
    });
    log('scheduler', { event: 'one-off-scheduled', jobId, runAt: runAt.getTime() });
    return c.json<ActionResult>({
      ok: true,
      message: `One-off job scheduled for ${utcStamp(runAt.getTime())}`,
      detail: jobId,
    });
  } catch (error) {
    log('scheduler', { event: 'one-off-schedule-failed', error: errText(error) });
    return c.json<ActionResult>({ ok: false, message: 'runJob failed', detail: errText(error) });
  }
});

api.post('/flair', async (c) => {
  const { action } = await c.req.json<FlairRequest>();
  const username = context.username ?? (await reddit.getCurrentUsername());
  const subredditName = context.subredditName;
  if (!username) {
    return c.json<ActionResult>({ ok: false, message: 'Not logged in' });
  }
  try {
    if (action === 'set') {
      await reddit.setUserFlair({
        subredditName,
        username,
        text: FLAIR_TEXT,
        backgroundColor: '#FF5A4E',
        textColor: 'light',
      });
    } else {
      await reddit.removeUserFlair(subredditName, username);
    }
    // Read it back so the pass/fail does not rest on the call merely not throwing.
    let readBack: string | null = null;
    let readBackError: string | null = null;
    try {
      const user = await reddit.getUserByUsername(username);
      const flair = await user?.getUserFlairBySubreddit(subredditName);
      readBack = flair?.flairText ?? null;
    } catch (error) {
      readBackError = errText(error);
    }
    const confirmed = action === 'set' ? readBack === FLAIR_TEXT : !readBack;
    log('flair', { action, readBack, readBackError, confirmed });
    return c.json<ActionResult>({
      ok: confirmed || readBackError !== null,
      message:
        action === 'set'
          ? `Flair set call succeeded. Server reads back: ${readBack ?? '(nothing)'}`
          : `Flair removed. Server reads back: ${readBack ?? '(nothing)'}`,
      detail: readBackError ?? `u/${username} in r/${subredditName}`,
    });
  } catch (error) {
    log('flair', { action, error: errText(error) });
    return c.json<ActionResult>({
      ok: false,
      message: `${action === 'set' ? 'setUserFlair' : 'removeUserFlair'} threw`,
      detail: errText(error),
    });
  }
});

api.post('/comment', async (c) => {
  const { mode, text } = await c.req.json<CommentRequest>();
  const postId = context.postId;
  if (!postId) {
    return c.json<ActionResult>({ ok: false, message: 'No postId in context' });
  }
  const body = text.slice(0, 500);
  try {
    let parentId: Parameters<typeof reddit.submitComment>[0]['id'] = postId;
    if (mode === 'reply') {
      // Docs require score comments to be replies to one stickied comment.
      let pinnedId = await redis.get(KEY.pinned(postId));
      if (!pinnedId) {
        const pinned = await reddit.submitComment({
          id: postId,
          text: 'Share your result as a reply to this comment.',
          runAs: 'APP',
        });
        let stickied = true;
        try {
          await pinned.distinguish(true);
        } catch (error) {
          stickied = false;
          log('comment', { event: 'sticky-failed', error: errText(error) });
        }
        pinnedId = pinned.id;
        await redis.set(KEY.pinned(postId), pinnedId);
        log('comment', { event: 'pinned-created', pinnedId, stickied });
      }
      const pinned = await reddit.getCommentById(pinnedId as `t1_${string}`);
      parentId = pinned.id;
    }
    const comment = await reddit.submitComment({ id: parentId, text: body, runAs: 'USER' });
    const asUser = comment.authorName === context.username;
    log('comment', {
      mode,
      commentId: comment.id,
      authorName: comment.authorName,
      expected: context.username,
      asUser,
    });
    return c.json<ActionResult>({
      ok: true,
      message: `Comment posted as u/${comment.authorName}${asUser ? ' (your account)' : ' (NOT your account)'}`,
      detail: comment.permalink,
    });
  } catch (error) {
    log('comment', { mode, error: errText(error) });
    return c.json<ActionResult>({
      ok: false,
      message: 'submitComment threw',
      detail: errText(error),
    });
  }
});

api.post('/notify', async (c) => {
  const { action } = await c.req.json<NotifyRequest>();
  const { userId, postId } = context;
  if (!userId || !postId) {
    return c.json<ActionResult>({ ok: false, message: 'Missing userId or postId' });
  }
  try {
    let message = '';
    let detail = '';
    let ok = true;
    if (action === 'optin') {
      const res = await notifications.optInCurrentUser();
      ok = res.success;
      message = res.success ? 'Opted in' : 'Opt-in refused';
      detail = JSON.stringify(res);
    } else if (action === 'optout') {
      const res = await notifications.optOutCurrentUser();
      ok = res.success;
      message = res.success ? 'Opted out' : 'Opt-out refused';
      detail = JSON.stringify(res);
    } else if (action === 'status') {
      const optedIn = await notifications.isOptedIn(userId);
      message = optedIn ? 'Server says: opted in' : 'Server says: not opted in';
      detail = JSON.stringify({ optedIn });
    } else if (action === 'send') {
      const res = await notifications.enqueue({
        title: 'Pattern #15 is ready',
        body: 'DarnIt! spike: tap to open the post.',
        recipients: [{ userId, link: postId, data: {} }],
      });
      ok = res.successCount > 0;
      message = ok
        ? `Queued ${res.successCount} notification. Watch your phone.`
        : `Enqueue returned ${res.failureCount} failure(s)`;
      detail = JSON.stringify(res);
    } else {
      const res = await notifications.requestShowGameBadge({ post: postId });
      ok = res.success;
      message = res.success ? 'Game badge requested' : 'Game badge refused';
      detail = JSON.stringify(res);
    }
    log('notifications', { action, ok, detail });
    return c.json<ActionResult>({ ok, message, detail });
  } catch (error) {
    log('notifications', { action, error: errText(error) });
    return c.json<ActionResult>({
      ok: false,
      message: `notifications.${action} threw`,
      detail: errText(error),
    });
  }
});

// ----------------------------------------------------------------- scheduler

internal.post('/scheduler/tick', async (c) => {
  const now = Date.now();
  await redis.zAdd(KEY.ticks, { member: String(now), score: now });
  await redis.zRemRangeByRank(KEY.ticks, 0, -241); // keep the last 4 hours
  return c.json<TaskResponse>({}, 200);
});

internal.post('/scheduler/cron-post', async (c) => {
  const firedAt = Date.now();
  const { data } = await c.req.json<TaskRequest<{ slot: string }>>();
  const slot = data?.slot ?? '00:00';
  const [hour = 0, minute = 0] = slot.split(':').map(Number);
  const day = new Date(firedAt);
  const scheduled = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    hour,
    minute
  );
  const lateMs = firedAt - scheduled;
  try {
    const post = await createSpikePost(
      `[spike] cron ${slot} UTC fired ${utcStamp(firedAt)} (+${(lateMs / 1000).toFixed(1)} s)`
    );
    await redis.zAdd(KEY.cronPosts, {
      member: JSON.stringify({ slot, firedAt, lateMs, postId: post.id }),
      score: firedAt,
    });
    log('scheduler', { event: 'cron-post', slot, firedAt, lateMs, postId: post.id });
  } catch (error) {
    log('scheduler', { event: 'cron-post-failed', slot, firedAt, lateMs, error: errText(error) });
  }
  return c.json<TaskResponse>({}, 200);
});

internal.post('/scheduler/one-off', async (c) => {
  const firedAt = Date.now();
  const { data } = await c.req.json<TaskRequest<{ runAt: number }>>();
  const runAt = data?.runAt ?? firedAt;
  const lateMs = firedAt - runAt;
  await redis.zAdd(KEY.oneOffs, {
    member: JSON.stringify({ runAt, firedAt, lateMs }),
    score: firedAt,
  });
  log('scheduler', { event: 'one-off-fired', runAt, firedAt, lateMs });
  return c.json<TaskResponse>({}, 200);
});

// ------------------------------------------------------------ menu + install

internal.post('/menu/post-create', async (c) => {
  try {
    const post = await createSpikePost(`[spike] manual post ${utcStamp(Date.now())}`);
    log('scheduler', { event: 'manual-post', postId: post.id });
    return c.json<UiResponse>({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    log('scheduler', { event: 'manual-post-failed', error: errText(error) });
    return c.json<UiResponse>({ showToast: 'Failed to create spike post' }, 400);
  }
});

internal.post('/menu/cleanup', async (c) => {
  const posts = await redis.zRange(KEY.posts, 0, -1);
  let deleted = 0;
  for (const { member } of posts) {
    try {
      const post = await reddit.getPostById(member as `t3_${string}`);
      await post.delete();
      deleted += 1;
    } catch (error) {
      log('cleanup', { postId: member, error: errText(error) });
    }
  }
  await redis.del(KEY.posts);
  log('cleanup', { found: posts.length, deleted });
  return c.json<UiResponse>({ showToast: `Deleted ${deleted} of ${posts.length} spike posts` });
});

internal.post('/triggers/on-app-install', async (c) => {
  try {
    const post = await createSpikePost('[spike] DarnIt! Day-1 spikes');
    log('render', { event: 'install-post', postId: post.id });
  } catch (error) {
    log('render', { event: 'install-post-failed', error: errText(error) });
  }
  return c.json<TriggerResponse>({}, 200);
});

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});

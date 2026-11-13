// Endpoints Reddit calls: the daily job, the install trigger, and the moderator menu.
// Each one must also be registered in devvit.json.

import { context } from '@devvit/web/server';
import type { TaskResponse } from '@devvit/web/server';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { Hono } from 'hono';
import { createDailyPost } from '../core/daily.ts';

export const internal = new Hono();

/** Runs at 01:00 UTC (02:00 Lagos) every day. */
internal.post('/scheduler/daily-post', async (c) => {
  try {
    await createDailyPost();
  } catch (error) {
    console.error('Daily post failed:', error);
  }
  return c.json<TaskResponse>({}, 200);
});

internal.post('/triggers/on-app-install', async (c) => {
  try {
    await createDailyPost();
  } catch (error) {
    console.error('Install post failed:', error);
  }
  return c.json<TriggerResponse>({}, 200);
});

/** Manual fallback if the scheduled job ever misses a day. */
internal.post('/menu/daily-post', async (c) => {
  try {
    const day = await createDailyPost();
    if (!day) return c.json<UiResponse>({ showToast: 'The pattern bank is used up' }, 200);
    return c.json<UiResponse>({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${day.postId}`,
    });
  } catch (error) {
    console.error('Manual post failed:', error);
    return c.json<UiResponse>({ showToast: 'Could not create the post' }, 400);
  }
});

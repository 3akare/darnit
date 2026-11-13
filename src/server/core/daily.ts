// Creates the day's post and records which pattern it carries. Shared by the scheduled
// job, the install trigger and the moderator menu fallback.

import { reddit, redis } from '@devvit/web/server';
import { chooseNextPattern, postTitle, recordDay } from './days.ts';
import type { Day } from './days.ts';

export const createDailyPost = async (): Promise<Day | undefined> => {
  const now = Date.now();
  const next = await chooseNextPattern(redis, Math.random);
  if (!next) {
    console.error('The pattern bank is used up: no post created.');
    return undefined;
  }
  const post = await reddit.submitCustomPost({ title: postTitle(next.day, now) });
  const day: Day = { day: next.day, patternId: next.pattern.id, postId: post.id, createdAt: now };
  await recordDay(redis, day);
  console.log(`Created day ${day.day} (${next.pattern.id}, ${next.pattern.difficulty}) as ${post.id}`);
  return day;
};

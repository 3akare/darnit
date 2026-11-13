// Stands in for `@devvit/web/server` in the off-Reddit preview build: an in-memory Redis
// saved to localStorage, and a request context for one pretend player.

import { createMemoryStore } from '../server/core/store.ts';

const STORAGE_KEY = 'darnit-preview-v1';

const load = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
};

const save = (data: Record<string, string>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private windows may refuse storage. The preview still works for this visit.
  }
};

export const redis = createMemoryStore(load(), save);

export const context: {
  postId: string | undefined;
  userId: string | undefined;
  username: string | undefined;
  subredditName: string;
} = {
  postId: undefined,
  userId: 't2_preview',
  username: 'preview-player',
  subredditName: 'DarnItGame',
};

// Per-player onboarding flags: SPEC "Onboarding", stored per user.

import type { Prefs } from '../../shared/api.ts';
import type { Store } from './store.ts';

const key = (userId: string): string => `prefs:${userId}`;

export const readPrefs = async (store: Store, userId: string): Promise<Prefs> => {
  const raw = await store.get(key(userId));
  const saved: Partial<Prefs> = raw ? JSON.parse(raw) : {};
  return { tutorialDone: saved.tutorialDone === true, crossIntroSeen: saved.crossIntroSeen === true };
};

/** Flags only ever turn on. */
export const markPrefs = async (store: Store, userId: string, update: Partial<Prefs>): Promise<Prefs> => {
  const prefs = await readPrefs(store, userId);
  if (update.tutorialDone === true) prefs.tutorialDone = true;
  if (update.crossIntroSeen === true) prefs.crossIntroSeen = true;
  await store.set(key(userId), JSON.stringify(prefs));
  return prefs;
};

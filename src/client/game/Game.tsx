// Loads today's pattern, then shows the play screen.

import { useEffect, useState } from 'react';
import type { TodayResponse } from '../../shared/api.ts';
import { fetchToday } from '../api.ts';
import { Play } from './Play.tsx';

export const Game = () => {
  const [loaded, setLoaded] = useState<{ today: TodayResponse; skew: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchToday().then(
      (today) => setLoaded({ today, skew: today.serverNow - Date.now() }),
      () => setFailed(true)
    );
  }, []);

  if (failed) return <p className="notice">Could not load today&apos;s pattern. Close this and try again.</p>;
  if (!loaded) return <p className="notice">Threading the needle…</p>;
  const { today, skew } = loaded;
  return <Play key={`${today.day}:${today.pattern.id}`} today={today} skew={skew} />;
};

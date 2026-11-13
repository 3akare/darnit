// Loads today's pattern, then shows the play screen.

import { useEffect, useState } from 'react';
import type { TodayResponse } from '../../shared/api.ts';
import { fetchToday, markPrefs, prefsFrom } from '../api.ts';
import { Play } from './Play.tsx';
import { Tutorial } from './Tutorial.tsx';

export const Game = () => {
  const [loaded, setLoaded] = useState<{ today: TodayResponse; skew: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [practising, setPractising] = useState<boolean | null>(null);

  useEffect(() => {
    fetchToday().then(
      (today) => {
        setLoaded({ today, skew: today.serverNow - Date.now() });
        // First play ever, and no result yet: the practice board comes first.
        setPractising(!prefsFrom(today).tutorialDone && !today.run?.finished);
      },
      () => setFailed(true)
    );
  }, []);

  if (failed) return <p className="notice">Could not load today&apos;s pattern. Close this and try again.</p>;
  if (!loaded) return <p className="notice">Threading the needle…</p>;
  const { today, skew } = loaded;
  if (practising) {
    return (
      <Tutorial
        onDone={() => {
          markPrefs({ tutorialDone: true });
          setPractising(false);
        }}
      />
    );
  }
  return <Play key={`${today.day}:${today.pattern.id}`} today={today} skew={skew} />;
};

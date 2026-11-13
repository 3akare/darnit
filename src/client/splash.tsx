// The inline feed card. Tap only: Reddit rejects inline views that capture gestures or
// scroll. The Start button opens the play screen in expanded mode.

import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { TodayResponse } from '../shared/api.ts';
import { formatTime } from '../shared/api.ts';
import { fetchToday } from './api.ts';

const NEEDLES = { easy: 1, medium: 2, hard: 3 };

const Splash = () => {
  const [today, setToday] = useState<TodayResponse | null>(null);
  useEffect(() => {
    fetchToday().then(setToday, () => undefined);
  }, []);
  const solved = today?.run?.finished && today.run.timeMs !== null;
  return (
    <main className="card">
      <h1>DarnIt!{today ? ` #${today.day}` : ''}</h1>
      {today ? (
        <span className="needles" aria-label={`${today.pattern.difficulty} difficulty`}>
          {Array.from({ length: NEEDLES[today.pattern.difficulty] }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      ) : null}
      {solved && today?.run?.timeMs != null ? <p>Stitched in {formatTime(today.run.timeMs)}</p> : null}
      <button type="button" className="primary" onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}>
        {solved ? 'See your result' : 'Start stitching'}
      </button>
    </main>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}

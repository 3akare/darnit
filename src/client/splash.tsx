// The inline feed card. Tap only: Reddit rejects inline views that capture gestures or
// scroll. The Start button opens the play screen in expanded mode.

import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/alfa-slab-one/latin-400.css';
import './styles.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { TodayResponse } from '../shared/api.ts';
import { formatTime } from '../shared/api.ts';
import { fetchToday } from './api.ts';
import { Needles } from './game/Craft.tsx';
import { Logo } from './game/Logo.tsx';
import { applyPaper } from './paper.ts';

const NEEDLES_FOR = { easy: 1, medium: 2, hard: 3 };

const Splash = () => {
  const [today, setToday] = useState<TodayResponse | null>(null);
  useEffect(() => {
    fetchToday().then(setToday, () => undefined);
  }, []);
  const time = today?.run?.finished ? today.run.timeMs : null;
  return (
    <main className="card">
      <Logo height={56} />
      {today ? (
        <div className="meta">
          <span className="number">No. {today.day}</span>
          <Needles count={NEEDLES_FOR[today.pattern.difficulty]} label={`${today.pattern.difficulty} pattern`} />
        </div>
      ) : null}
      {time !== null ? <p>Stitched in {formatTime(time)}</p> : null}
      <button type="button" className="patch wool" onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}>
        {time !== null ? 'See your result' : 'Start stitching'}
      </button>
    </main>
  );
};

applyPaper();
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}

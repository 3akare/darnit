// Inline feed card. Tap-only on purpose: Reddit rejects inline views that capture gestures.
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './spike.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SHARE_TEXT, errText, platform, report, viewMode } from './lib';

const Splash = () => {
  const [copy, setCopy] = useState('');
  const inlineCopy = async () => {
    const outcome = await navigator.clipboard.writeText(SHARE_TEXT).then(
      () => 'resolved',
      (error: unknown) => `threw ${errText(error)}`
    );
    setCopy(outcome);
    void report('clipboard', 'info', { inlineClipboardApi: outcome });
  };
  return (
    <main className="splash">
      <h1>DarnIt! spikes</h1>
      <p>
        u/{context.username ?? 'logged-out'} · {platform()} · {viewMode()}
      </p>
      <button className="primary big" onClick={(e) => requestExpandedMode(e.nativeEvent, 'spike')}>
        Open the spikes
      </button>
      <button onClick={() => void inlineCopy()}>Copy from the feed card</button>
      <p className="hint">{copy ? `Inline copy: ${copy}` : 'Throwaway app. Nothing here ships.'}</p>
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

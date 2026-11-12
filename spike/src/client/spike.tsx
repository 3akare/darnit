// Expanded view: the checks list and the drag-performance board.
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './spike.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { InitResponse } from '../shared/api';
import { Checks } from './checks';
import { DragTest } from './drag';
import { errText, platform, report, viewMode } from './lib';

const App = () => {
  const [tab, setTab] = useState<'checks' | 'drag'>('checks');
  const [init, setInit] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: InitResponse = await res.json();
        setInit(data);
        void report('render', 'pass', {
          mode: viewMode(),
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          dpr: window.devicePixelRatio,
          ua: navigator.userAgent,
          appVersion: data.appVersion,
        });
      } catch (e) {
        setError(errText(e));
      }
    };
    void load();
  }, []);

  return (
    <div className={tab === 'drag' ? 'app locked' : 'app'}>
      <header>
        <strong>DarnIt! spikes</strong>
        <span>
          u/{init?.username ?? '…'} · {platform()} · {viewMode()}
        </span>
        <nav className="seg">
          <button className={tab === 'checks' ? 'on' : ''} onClick={() => setTab('checks')}>
            Checks
          </button>
          <button className={tab === 'drag' ? 'on' : ''} onClick={() => setTab('drag')}>
            Drag test
          </button>
        </nav>
      </header>
      {error ? <p className="result bad">Could not reach the server: {error}</p> : null}
      {tab === 'drag' ? <DragTest /> : init ? <Checks init={init} /> : <p className="hint">Loading…</p>}
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

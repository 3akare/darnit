// Off-Reddit test build. The real client and the real server routes run together in this
// page, so the game can be played on a phone without a Reddit account. It is a test tool:
// it is not part of the app that gets uploaded to Reddit.

import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '../client/styles.css';
import './preview.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../client/game/Game.tsx';
import { applyPaper } from '../client/paper.ts';
import type { Difficulty } from '../shared/puzzle/pattern.ts';
import { ensureDay, nextPattern } from './backend.ts';

const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];

const Preview = () => {
  const [round, setRound] = useState(0);
  useEffect(() => {
    void ensureDay().then(() => setRound(1));
  }, []);
  const go = (difficulty: Difficulty) => {
    void nextPattern(difficulty).then(() => setRound((n) => n + 1));
  };
  return (
    <div className="preview">
      <nav className="devbar">
        <span>Test build · new pattern:</span>
        {TIERS.map((tier) => (
          <button key={tier} type="button" onClick={() => go(tier)}>
            {tier}
          </button>
        ))}
      </nav>
      {round > 0 ? <Game key={round} /> : null}
    </div>
  );
};

applyPaper();
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Preview />
    </StrictMode>
  );
}

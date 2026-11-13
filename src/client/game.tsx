import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './game/Game.tsx';
import { applyPaper } from './paper.ts';

applyPaper();
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Game />
    </StrictMode>
  );
}

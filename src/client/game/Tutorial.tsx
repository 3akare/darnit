// First play ever: a 4x4 practice pattern with a hand pointing at each next square, until
// the thread reaches the last button. Skip is always on screen. Nothing here is sent to
// the server except the "tutorial done" flag.

import { useCallback, useMemo, useState } from 'react';
import { compile, isComplete } from '../../shared/puzzle/pattern.ts';
import { PRACTICE, guideCell } from '../../shared/puzzle/practice.ts';
import type { Stitch } from '../../shared/puzzle/stitching.ts';
import { Board } from './Board.tsx';
import { Logo } from './Logo.tsx';

export const Tutorial = ({ onDone }: { onDone: () => void }) => {
  const board = useMemo(() => compile(PRACTICE), []);
  const [thread, setThread] = useState<readonly number[]>([PRACTICE.buttons[0] ?? 0]);
  const [finished, setFinished] = useState(false);
  const onStitch = useCallback(
    (stitch: Stitch) => {
      setThread(stitch.thread);
      if (stitch.added > 0 && isComplete(board, stitch.thread)) setFinished(true);
    },
    [board]
  );
  const guide = guideCell(thread, PRACTICE.solution);
  const message = finished
    ? 'That is all there is to it. Now for today’s pattern.'
    : guide.back
      ? 'Off the pattern. Drag the thread back to the hand to unpick.'
      : thread.length === 1
        ? 'Drag from button 1, following the hand.'
        : 'Keep going: pass the buttons in order and fill every square.';

  return (
    <main className="play tutorial">
      <header className="masthead">
        <Logo height={50} />
        <button type="button" className="skip" onClick={onDone}>
          Skip
        </button>
      </header>
      <h2 className="lesson">How to play</h2>
      <Board
        pattern={PRACTICE}
        board={board}
        thread={thread}
        hintCell={-1}
        hintUntil={0}
        solved={finished}
        locked={finished}
        empty={[]}
        guideCell={finished ? -1 : guide.cell}
        onStitch={onStitch}
      />
      <p className="status" role="status">
        {message}
      </p>
      {finished ? (
        <footer className="bar controls">
          <button type="button" className="patch wool" onClick={onDone}>
            Start today&apos;s pattern
          </button>
        </footer>
      ) : null}
    </main>
  );
};

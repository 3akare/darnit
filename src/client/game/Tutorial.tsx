// First play ever: one line on the goal, then a 4x4 practice pattern where the grid itself
// lights the next squares to take, with arrows showing the way. Skip is always on screen.
// Nothing here is sent to the server except the "tutorial done" flag.

import { useCallback, useMemo, useState } from 'react';
import { compile, isComplete } from '../../shared/puzzle/pattern.ts';
import { PRACTICE, guideCell } from '../../shared/puzzle/practice.ts';
import type { Stitch } from '../../shared/puzzle/stitching.ts';
import { Board } from './Board.tsx';
import { Logo } from './Logo.tsx';

const NONE: readonly number[] = [];
const LAST = PRACTICE.buttons.length;

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

  const next = guideCell(thread, PRACTICE.solution);
  const guide = useMemo(() => {
    if (finished || next.cell < 0) return NONE;
    if (next.back) return [next.cell];
    // Light the next three squares, fading, so the way ahead reads at a glance.
    const at = PRACTICE.solution.indexOf(next.cell, thread.length - 1);
    return PRACTICE.solution.slice(at, at + 3);
  }, [finished, next.cell, next.back, thread.length]);

  const message = finished
    ? 'That’s it. Every daily pattern works the same way.'
    : next.back
      ? 'Wrong way. Drag back to the outlined square to unpick.'
      : thread.length === 1
        ? 'Put your finger on 1 and drag into the orange square.'
        : 'Keep following the orange squares.';

  return (
    <main className="play tutorial">
      <header className="masthead">
        <Logo height={50} />
        <button type="button" className="skip" onClick={onDone}>
          Skip
        </button>
      </header>
      <div className="lesson">
        <h2>How to play</h2>
        <p>
          Draw one thread from 1 to {LAST}, passing the numbers in order, and fill every square on the way.
        </p>
      </div>
      <Board
        pattern={PRACTICE}
        board={board}
        thread={thread}
        hintCell={-1}
        hintUntil={0}
        solved={finished}
        locked={finished}
        empty={NONE}
        guide={guide}
        guideBack={next.back}
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

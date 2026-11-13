// The play screen: timer and Reset on top, the fabric in its hoop, Undo and Hint below.
// Nothing else is on screen while playing, and nothing scrolls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HINT_COOLDOWN_MS, badgeFor, badgeLabel, formatTime } from '../../shared/api.ts';
import type { SubmitResponse, TodayResponse } from '../../shared/api.ts';
import { compile, isComplete } from '../../shared/puzzle/pattern.ts';
import { createUnpickCounter, cutTo, dragTo, resetThread, undoStitch } from '../../shared/puzzle/stitching.ts';
import type { Stitch } from '../../shared/puzzle/stitching.ts';
import { askHint, startRun, submitThread } from '../api.ts';
import { Board } from './Board.tsx';

type Result = { timeMs: number; hints: number; unpicks: number; counted: boolean; note: string };

const NEEDLES = { easy: 1, medium: 2, hard: 3 };

type Props = {
  today: TodayResponse;
  /** Server clock minus this device's clock, measured when the pattern loaded. */
  skew: number;
};

export const Play = ({ today, skew }: Props) => {
  const { pattern } = today;
  const board = useMemo(() => compile(pattern), [pattern]);
  const firstCell = pattern.buttons[0] ?? 0;

  const [thread, setThread] = useState<number[]>([firstCell]);
  const threadRef = useRef(thread);
  const counter = useRef(createUnpickCounter());
  const hints = useRef(today.run?.hints ?? 0);

  // The on-screen clock is display only. The server stamps the real start and finish.
  const [startedAt, setStartedAt] = useState<number | null>(today.run?.startedAt ? today.run.startedAt - skew : null);
  /** This device's clock, refreshed four times a second while a run is under way. */
  const [now, setNow] = useState(today.serverNow - skew);
  const [result, setResult] = useState<Result | null>(
    today.run?.finished && today.run.timeMs !== null
      ? { timeMs: today.run.timeMs, hints: today.run.hints, unpicks: today.run.unpicks ?? 0, counted: today.isToday, note: '' }
      : null
  );
  const [hint, setHint] = useState({ cell: -1, until: 0 });
  const [hintReadyAt, setHintReadyAt] = useState(today.run ? today.run.hintReadyAt - skew : 0);
  const [hintBusy, setHintBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (startedAt === null || result) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, result]);

  const clock = startedAt === null ? 0 : Math.max(0, now - startedAt);
  const coolingDown = hintReadyAt > now;

  const finish = useCallback(
    async (finalThread: number[]) => {
      if (submitting.current) return;
      submitting.current = true;
      const localMs = startedAt === null ? 0 : Date.now() - startedAt;
      const unpicks = counter.current.count;
      const response: SubmitResponse | null = await submitThread(finalThread, unpicks).catch(() => null);
      if (response?.ok) {
        setResult({ timeMs: response.timeMs, hints: response.hints, unpicks: response.unpicks, counted: response.counted, note: '' });
      } else {
        // Still show the solve; say plainly that it was not recorded.
        const why = response ? response.reason : 'offline';
        setResult({
          timeMs: localMs,
          hints: hints.current,
          unpicks,
          counted: false,
          note: why === 'logged-out' ? 'Log in to Reddit to save your time.' : `Not recorded (${why}).`,
        });
      }
    },
    [startedAt]
  );

  /** Every change to the thread goes through here. */
  const apply = useCallback(
    (stitch: Stitch, countsAsUnpick = true) => {
      if (stitch.added === 0 && stitch.removed === 0) return;
      if (countsAsUnpick || stitch.added > 0) counter.current.note(stitch);
      threadRef.current = stitch.thread;
      setThread(stitch.thread);
      setMessage('');
      if (stitch.added > 0 && startedAt === null) {
        // First stitch: start the clock here and on the server.
        setStartedAt(Date.now());
        setNow(Date.now());
        void startRun().catch(() => undefined);
      }
      if (stitch.added > 0 && isComplete(board, stitch.thread)) void finish(stitch.thread);
    },
    [board, finish, startedAt]
  );

  const onDrag = useCallback((cell: number) => apply(dragTo(board, threadRef.current, cell)), [apply, board]);
  const onCut = useCallback((cell: number) => apply(cutTo(threadRef.current, cell)), [apply]);
  const onUndo = () => apply(undoStitch(threadRef.current));
  const onReset = () => apply(resetThread(board, threadRef.current));

  const onHint = async () => {
    if (hintBusy || coolingDown || result) return;
    setHintBusy(true);
    try {
      if (startedAt === null) {
        setStartedAt(Date.now());
        setNow(Date.now());
        await startRun();
      }
      const response = await askHint(threadRef.current);
      if (response.ok) {
        hints.current += 1;
        // A hint rewind is not an unpick: hint users get no badge anyway.
        if (response.keep < threadRef.current.length) {
          const kept = threadRef.current.slice(0, response.keep);
          apply({ thread: kept, added: 0, removed: threadRef.current.length - kept.length }, false);
        }
        setHint({ cell: response.next, until: performance.now() + 1600 });
        setNow(Date.now());
        setHintReadyAt(Date.now() + HINT_COOLDOWN_MS);
      } else if (response.reason === 'cooldown' && response.hintReadyAt) {
        setHintReadyAt(response.hintReadyAt - skew);
      } else if (response.reason === 'logged-out') {
        setMessage('Log in to Reddit to use hints.');
      } else {
        setMessage('No hint available right now.');
      }
    } catch {
      setMessage('Could not reach the server for a hint.');
    } finally {
      setHintBusy(false);
    }
  };

  const total = board.total;
  const badge = result ? badgeLabel(badgeFor(result.hints, result.unpicks), result.unpicks) : '';

  return (
    <main className="play">
      <header className="bar">
        <div className="title">
          <strong>DarnIt! #{today.day}</strong>
          <span className="needles" aria-label={`${pattern.difficulty} difficulty`}>
            {Array.from({ length: NEEDLES[pattern.difficulty] }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </div>
        <output className="timer">{formatTime(result ? result.timeMs : clock)}</output>
        <button type="button" onClick={onReset} disabled={Boolean(result) || thread.length <= 1}>
          Reset
        </button>
      </header>

      <Board
        pattern={pattern}
        board={board}
        thread={thread}
        hintCell={hint.cell}
        hintUntil={hint.until}
        solved={Boolean(result)}
        locked={Boolean(result)}
        onDrag={onDrag}
        onCut={onCut}
      />

      <p className="status" role="status">
        {message || `${thread.length} of ${total} stitches`}
      </p>

      <footer className="bar">
        <button type="button" onClick={onUndo} disabled={Boolean(result) || thread.length <= 1}>
          Undo
        </button>
        <button
          type="button"
          className={coolingDown ? 'hint cooling' : 'hint'}
          style={{ animationDuration: `${HINT_COOLDOWN_MS}ms` }}
          onClick={() => void onHint()}
          disabled={Boolean(result) || hintBusy || coolingDown}
        >
          Hint
        </button>
      </footer>

      {result ? (
        <section className="solved" aria-live="polite">
          <h2>
            #{today.day} stitched in {formatTime(result.timeMs)}
          </h2>
          {badge ? <p className="badge">{badge}</p> : null}
          <p className="fine">
            {result.note || (result.counted ? '' : 'Practice pattern: not counted.')}
          </p>
        </section>
      ) : null}
    </main>
  );
};

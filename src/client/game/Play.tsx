// The play screen: logo, timer and Reset on top, the board, Undo and Hint below.
// Nothing else is on screen while playing, and nothing scrolls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HINT_COOLDOWN_MS, badgeFor, formatTime } from '../../shared/api.ts';
import type { SubmitResponse, TodayResponse } from '../../shared/api.ts';
import { compile, isComplete } from '../../shared/puzzle/pattern.ts';
import { createUnpickCounter, resetThread, undoStitch } from '../../shared/puzzle/stitching.ts';
import type { Stitch } from '../../shared/puzzle/stitching.ts';

import { askHint, startRun, submitThread } from '../api.ts';
import { Board } from './Board.tsx';
import { Icon, Level } from './Craft.tsx';
import { Logo } from './Logo.tsx';
import { ResultCard } from './ResultCard.tsx';
import type { Result } from './ResultCard.tsx';
import { Results } from '../results/Results.tsx';


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
  // Squares the player unpicked back to, for the day's wrong-turn heatmap.
  const unpickCells = useRef(new Set<number>());
  const retreatEnd = useRef(-1);
  const hints = useRef(today.run?.hints ?? 0);

  // The on-screen clock is display only. The server stamps the real start and finish.
  const [startedAt, setStartedAt] = useState<number | null>(today.run?.startedAt ? today.run.startedAt - skew : null);
  /** This device's clock, refreshed four times a second while a run is under way. */
  const [now, setNow] = useState(today.serverNow - skew);
  const [result, setResult] = useState<Result | null>(
    today.run?.finished && today.run.timeMs !== null
      ? {
          timeMs: today.run.timeMs,
          hints: today.run.hints,
          unpicks: today.run.unpicks ?? 0,
          badge: badgeFor(today.run.hints, today.run.unpicks ?? 0),
          counted: today.isToday,
          standing: today.standing,
          note: '',
        }
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
      if (retreatEnd.current >= 0) unpickCells.current.add(retreatEnd.current);
      const response: SubmitResponse | null = await submitThread(finalThread, unpicks, [...unpickCells.current]).catch(
        () => null
      );
      if (response?.ok) {
        setResult({
          timeMs: response.timeMs,
          hints: response.hints,
          unpicks: response.unpicks,
          badge: response.badge,
          counted: response.counted,
          standing: response.standing,
          note: '',
        });
      } else {
        // Still show the solve; say plainly that it was not recorded.
        const why = response ? response.reason : 'offline';
        setResult({
          timeMs: localMs,
          hints: hints.current,
          unpicks,
          badge: badgeFor(hints.current, unpicks),
          counted: false,
          standing: null,
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
      if (countsAsUnpick && stitch.removed > 0) retreatEnd.current = stitch.thread[stitch.thread.length - 1] ?? -1;
      if (stitch.added > 0 && retreatEnd.current >= 0) {
        unpickCells.current.add(retreatEnd.current);
        retreatEnd.current = -1;
      }
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

  const onStitch = useCallback((stitch: Stitch) => apply(stitch), [apply]);
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

  // The solve moment: the finished thread stays on screen briefly, then the Results page.
  const [showResults, setShowResults] = useState(Boolean(result));
  useEffect(() => {
    if (!result || showResults) return;
    const id = window.setTimeout(() => setShowResults(true), 1600);
    return () => window.clearTimeout(id);
  }, [result, showResults]);

  const total = board.total;
  const lastButton = pattern.buttons[pattern.buttons.length - 1] ?? -1;
  // Every button joined but squares left over: say so plainly and show which squares.
  const endedEarly = !result && thread.length < total && thread.includes(lastButton);
  const empty = useMemo(() => {
    if (!endedEarly) return [];
    const count = new Map<number, number>();
    for (const c of thread) count.set(c, (count.get(c) ?? 0) + 1);
    const out: number[] = [];
    for (let c = 0; c < board.count; c++) {
      if ((count.get(c) ?? 0) < (board.isCross[c] ? 2 : 1)) out.push(c);
    }
    return out;
  }, [endedEarly, thread, board]);
  const emptySquares = empty.length;
  const status = message
    ? message
    : endedEarly
      ? `Every square must be filled: ${emptySquares} still empty. Unpick and fill them.`
      : thread.length <= 1 && !result
        ? `Join 1 to ${pattern.buttons.length} in order and fill every square.`
        : `${thread.length} of ${total} stitches`;

  if (result && showResults) return <Results today={today} result={result} />;

  return (
    <main className="play">
      <header className="masthead">
        <Logo height={58} />
        <div className="meta">
          <span className="number">No. {today.day}</span>
          <Level difficulty={pattern.difficulty} />
        </div>
      </header>

      <div className="bar">
        <output className="timer" aria-label="Time">
          {formatTime(result ? result.timeMs : clock)}
        </output>
        <button type="button" className="patch ink" onClick={onReset} disabled={Boolean(result) || thread.length <= 1}>
          <Icon name="reset" />
          Reset
        </button>
      </div>

      <Board
        pattern={pattern}
        board={board}
        thread={thread}
        hintCell={hint.cell}
        hintUntil={hint.until}
        solved={Boolean(result)}
        locked={Boolean(result)}
        empty={empty}
        onStitch={onStitch}
      />

      <p className={endedEarly ? 'status warn' : 'status'} role="status">
        {status}
      </p>

      <footer className="bar controls" hidden={Boolean(result)}>
        <button type="button" className="patch cobalt" onClick={onUndo} disabled={Boolean(result) || thread.length <= 1}>
          <Icon name="undo" />
          Undo
        </button>
        <button
          type="button"
          className={coolingDown ? 'patch magenta cooling' : 'patch magenta'}
          onClick={() => void onHint()}
          disabled={Boolean(result) || hintBusy || coolingDown}
        >
          <Icon name="hint" />
          Hint
          {coolingDown ? (
            <span className="cooldown" style={{ animationDuration: `${Math.max(0, hintReadyAt - now)}ms` }} aria-hidden="true" />
          ) : null}
        </button>
      </footer>

      {result ? <ResultCard day={today.day} subredditName={today.subredditName} result={result} /> : null}
    </main>
  );
};

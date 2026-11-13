// The pieces of the Results page: leaderboard, heatmap, stats and quilts.

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { badgeLabel, formatTime } from '../../shared/api.ts';
import type { LeaderRow, QuiltSquare, Stats } from '../../shared/api.ts';
import type { Pattern } from '../../shared/puzzle/pattern.ts';
import { drawHeatmap, drawQuilt, squareAt } from './quiltDraw.ts';
import type { QuiltGeometry, QuiltKind } from './quiltDraw.ts';

/** Re-run a draw whenever the element changes width. */
const useWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(Math.floor(el.getBoundingClientRect().width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

const AVATAR_COLOURS = ['#2F5BEA', '#C0247A', '#15803D', '#B45309', '#7A4FB8', '#0E7490'];

const Avatar = ({ name, src }: { name: string; src: string | null }) => {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img className="avatar" src={src} alt="" onError={() => setFailed(true)} />;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="avatar stitched" style={{ background: AVATAR_COLOURS[hash % AVATAR_COLOURS.length] }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
};

const Row = ({ row }: { row: LeaderRow }) => (
  <li className={row.me ? 'row me' : 'row'}>
    <span className="rank">{row.rank}</span>
    <Avatar name={row.username} src={row.snoovatar} />
    <span className="who">
      <span className="name">u/{row.username}</span>
      {badgeLabel(row.badge, row.unpicks) ? <span className="row-badge">{badgeLabel(row.badge, row.unpicks)}</span> : null}
    </span>
    <span className="time">{formatTime(row.timeMs)}</span>
  </li>
);

export const Leaderboard = ({ top, me, solvers }: { top: LeaderRow[]; me: LeaderRow | null; solvers: number }) => (
  <section className="sheet">
    <h3>Today&apos;s leaderboard</h3>
    <p className="explain">The fastest finishes on today&apos;s pattern. Your row is outlined in red.</p>
    {top.length === 0 ? <p className="fine">Nobody has finished yet.</p> : null}
    <ol className="board-list">
      {top.map((row) => (
        <Row key={`${row.rank}-${row.username}`} row={row} />
      ))}
    </ol>
    {me ? (
      <ol className="board-list pinned">
        <Row row={me} />
      </ol>
    ) : null}
    <p className="fine">
      {solvers} {solvers === 1 ? 'player has' : 'players have'} stitched today&apos;s pattern.
    </p>
  </section>
);

export const Heatmap = ({
  pattern,
  solution,
  counts,
  players,
}: {
  pattern: Pattern;
  solution: number[];
  counts: number[];
  players: number;
}) => {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(box);
  let hottest = -1;
  counts.forEach((n, c) => {
    if (n > 0 && (hottest < 0 || n > (counts[hottest] ?? 0))) hottest = c;
  });
  useEffect(() => {
    if (canvas.current && width > 0) drawHeatmap(canvas.current, Math.min(width, 320), pattern, solution, counts, hottest);
  }, [width, pattern, solution, counts, hottest]);

  let caption = 'Nobody took a wrong turn today. Clean stitching all round.';
  if (hottest >= 0) {
    const n = counts[hottest] ?? 0;
    const button = pattern.buttons.indexOf(hottest);
    const where = button >= 0 ? `at button ${button + 1}` : 'at the circled square';
    // SPEC: counts, not percentages, while fewer than 20 have played.
    const who = players >= 20 ? `${Math.round((100 * n) / players)}% of players` : `${n} of ${players} ${players === 1 ? 'player' : 'players'}`;
    caption = `${who} took a wrong turn ${where} and had to unpick.`;
  }
  return (
    <section className="sheet">
      <h3>Today&apos;s trickiest spot</h3>
      <p className="explain">
        The faint red line is today&apos;s solution. Orange squares are where players went the wrong way and had to go back:
        the darker, the more players.
      </p>
      <div ref={box} className="heat-box">
        <canvas ref={canvas} aria-label={caption} />
      </div>
      <p className="caption">{caption}</p>
    </section>
  );
};

export const StatsPanel = ({ stats }: { stats: Stats }) => (
  <section className="sheet">
    <h3>Your stats</h3>
    <dl className="stats">
      <div>
        <dt>Played</dt>
        <dd>{stats.plays}</dd>
      </div>
      <div>
        <dt>Best time</dt>
        <dd>{stats.bestMs === null ? '–' : formatTime(stats.bestMs)}</dd>
      </div>
      <div>
        <dt>Streak</dt>
        <dd>{stats.currentStreak}</dd>
      </div>
      <div>
        <dt>Longest</dt>
        <dd>{stats.maxStreak}</dd>
      </div>
    </dl>
    {stats.nextMilestone ? (
      <p className="caption">
        {stats.nextMilestone.toGo} more {stats.nextMilestone.toGo === 1 ? 'day' : 'days'} in a row for {stats.nextMilestone.reward}.
      </p>
    ) : (
      <p className="caption">Every streak reward unlocked.</p>
    )}
  </section>
);

type QuiltProps = {
  title: string;
  explain: string;
  squares: QuiltSquare[];
  kind: QuiltKind;
  today: number;
};

const describe = (sq: QuiltSquare, kind: QuiltKind): string => {
  const level = sq.difficulty[0]?.toUpperCase() + sq.difficulty.slice(1);
  if (kind === 'community') return `#${sq.day} · ${level} · ${sq.solvers} ${sq.solvers === 1 ? 'solver' : 'solvers'}`;
  if (sq.timeMs === null) return `#${sq.day} · ${level} · not stitched`;
  const badge = sq.badge ? badgeLabel(sq.badge, sq.unpicks) : '';
  return [`#${sq.day}`, formatTime(sq.timeMs), badge].filter(Boolean).join(' · ');
};

export const Quilt = ({ title, explain, squares, kind, today }: QuiltProps) => {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const geo = useRef<QuiltGeometry | null>(null);
  const width = useWidth(box);
  const [selected, setSelected] = useState(-1);
  useEffect(() => {
    if (canvas.current && width > 0) geo.current = drawQuilt(canvas.current, width, squares, kind, today, selected);
  }, [width, squares, kind, today, selected]);

  const onTap = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!geo.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = squareAt(e.clientX - rect.left, e.clientY - rect.top, squares.length, geo.current);
    setSelected(i === selected ? -1 : i);
  };
  const picked = squares[selected];
  return (
    <section className="sheet">
      <h3>{title}</h3>
      <p className="explain">{explain}</p>
      <div ref={box} className="quilt-box">
        <canvas ref={canvas} onPointerUp={onTap} role="img" aria-label={`${title}: ${squares.length} squares`} />
      </div>
      <p className="caption">{picked ? describe(picked, kind) : 'Tap a square to see that day.'}</p>
    </section>
  );
};

export const Countdown = ({ until, offset }: { until: number; offset: number }) => {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => window.clearInterval(id);
  }, [offset]);
  const left = Math.max(0, until - now);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  return <p className="countdown">Next pattern in {hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`}</p>;
};

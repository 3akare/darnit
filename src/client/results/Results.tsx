// The Results page, one scroll: solve card, leaderboard, where players went wrong, stats,
// your quilt, the subreddit quilt, and a way into the comments.

import { navigateTo } from '@devvit/web/client';
import { useEffect, useState } from 'react';
import type { ResultsResponse, TodayResponse } from '../../shared/api.ts';
import { fetchResults } from '../api.ts';
import { Icon, Level } from '../game/Craft.tsx';
import { Logo } from '../game/Logo.tsx';
import { ResultCard } from '../game/ResultCard.tsx';
import type { Result } from '../game/ResultCard.tsx';
import { Countdown, Heatmap, Leaderboard, Quilt, StatsPanel } from './Sections.tsx';

type Loaded = Extract<ResultsResponse, { ok: true }>;

export const Results = ({ today, result }: { today: TodayResponse; result: Result }) => {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState('');
  const [offset] = useState(() => today.serverNow - Date.now());

  useEffect(() => {
    fetchResults().then(
      (response) => (response.ok ? setData(response) : setFailed(response.reason)),
      () => setFailed('offline')
    );
  }, []);

  const discuss = () => {
    const postId = today.postId;
    if (postId) navigateTo(`https://www.reddit.com/r/${today.subredditName}/comments/${postId.replace(/^t3_/, '')}`);
  };

  return (
    <main className="results">
      <header className="masthead">
        <Logo height={50} />
        <div className="meta">
          <span className="number">No. {today.day}</span>
          <Level difficulty={today.pattern.difficulty} />
        </div>
      </header>
      {today.isToday ? <Countdown until={today.nextResetAt} offset={offset} /> : null}

      <ResultCard day={today.day} subredditName={today.subredditName} result={result} inline />

      {failed ? <p className="fine">Could not load today&apos;s results ({failed}).</p> : null}
      {!data && !failed ? <p className="fine">Gathering today&apos;s results…</p> : null}
      {data ? (
        <>
          <Leaderboard top={data.leaderboard.top} me={data.leaderboard.me} solvers={data.leaderboard.solvers} />
          <Heatmap pattern={data.pattern} counts={data.heatmap.counts} players={data.heatmap.players} />
          <StatsPanel stats={data.stats} />
          <Quilt title="Your quilt" squares={data.quilt} kind="personal" today={data.day} />
          <Quilt title={`r/${data.subredditName} quilt`} squares={data.community} kind="community" today={data.day} />
        </>
      ) : null}

      <button type="button" className="patch ink discuss" onClick={discuss}>
        <Icon name="share" />
        Discuss today&apos;s pattern
      </button>
    </main>
  );
};

// The tap-through checks: one card per row of the Day-1 spikes table.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { canRunAsUser, showShareSheet } from '@devvit/web/client';
import type { ActionResult, InitResponse, SchedulerStatus, SpikeId } from '../shared/api';
import {
  SHARE_TEXT,
  copyWithExecCommand,
  errText,
  median,
  postAction,
  report,
} from './lib';

const Card = ({ n, title, children }: { n: string; title: string; children: ReactNode }) => (
  <section className="card">
    <h2>
      <span className="num">{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

const Result = ({ result }: { result: ActionResult | null }) =>
  result ? (
    <p className={result.ok ? 'result ok' : 'result bad'}>
      {result.ok ? 'OK' : 'FAILED'} · {result.message}
      {result.detail ? <small>{result.detail}</small> : null}
    </p>
  ) : null;

/** The human verdict: only David can see a flair, a paste or a notification. */
const Verdict = ({
  spike,
  yes,
  no,
  evidence,
}: {
  spike: SpikeId;
  yes: string;
  no: string;
  evidence: () => unknown;
}) => {
  const [picked, setPicked] = useState<'pass' | 'fail' | null>(null);
  const pick = (outcome: 'pass' | 'fail') => {
    setPicked(outcome);
    void report(spike, outcome, { verdict: outcome === 'pass' ? yes : no, evidence: evidence() });
  };
  return (
    <div className="verdict">
      <button className={picked === 'pass' ? 'on good' : 'good'} onClick={() => pick('pass')}>
        {yes}
      </button>
      <button className={picked === 'fail' ? 'on bad' : 'bad'} onClick={() => pick('fail')}>
        {no}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------- font

const FontCard = () => {
  const [state, setState] = useState('checking…');
  const evidence = useRef<Record<string, unknown>>({});
  useEffect(() => {
    const run = async () => {
      const face = '500 20px "Space Grotesk"';
      let loadCount = -1;
      let loadError: string | null = null;
      try {
        loadCount = (await document.fonts.load(face, 'DarnIt! 0123456789')).length;
      } catch (error) {
        loadError = errText(error);
      }
      const check = document.fonts.check(face);
      // Width test: if the bundled font rendered, it measures differently from the fallback.
      const probe = document.createElement('span');
      probe.textContent = 'DarnIt! 0123456789 mmmmiiii';
      probe.style.cssText = 'position:absolute;visibility:hidden;font-size:40px;white-space:nowrap';
      document.body.appendChild(probe);
      probe.style.fontFamily = 'monospace';
      const fallbackWidth = probe.getBoundingClientRect().width;
      probe.style.fontFamily = '"Space Grotesk", monospace';
      const fontWidth = probe.getBoundingClientRect().width;
      document.body.removeChild(probe);
      const rendered = check && Math.abs(fontWidth - fallbackWidth) > 1;
      evidence.current = { loadCount, loadError, check, fallbackWidth, fontWidth, rendered };
      setState(
        rendered
          ? 'Bundled font loaded and rendered'
          : `Bundled font did NOT render (load=${loadCount}, check=${check})`
      );
      void report('font', rendered ? 'pass' : 'fail', evidence.current);
    };
    void run();
  }, []);
  return (
    <Card n="1" title="Bundled font">
      <p className="sample grotesk">DarnIt! #14 · 0:48 · 0123456789</p>
      <p className="sample system">DarnIt! #14 · 0:48 · 0123456789</p>
      <p className="hint">
        Top line is the bundled Space Grotesk, bottom line is the system font. They should look
        different.
      </p>
      <p className="result">{state}</p>
      <Verdict
        spike="font"
        yes="Lines look different"
        no="Lines look the same"
        evidence={() => evidence.current}
      />
    </Card>
  );
};

// ----------------------------------------------------------------- clipboard

const ClipboardCard = () => {
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [pasted, setPasted] = useState('');
  const [last, setLast] = useState('none');
  const note = (method: string, outcome: string) => {
    setLast(method);
    setMethods((m) => {
      const next = { ...m, [method]: outcome };
      void report('clipboard', 'info', { methods: next });
      return next;
    });
  };
  const matches = pasted.replace(/\r\n/g, '\n').trim() === SHARE_TEXT;
  const reported = useRef(false);
  useEffect(() => {
    if (matches && !reported.current) {
      reported.current = true;
      void report('clipboard', 'pass', { pasteMatchedAfter: last, methods });
    }
  }, [matches, methods, last]);

  const viaApi = async () => {
    try {
      if (!navigator.clipboard) throw new Error('navigator.clipboard is undefined');
      await navigator.clipboard.writeText(SHARE_TEXT);
      note('clipboardApi', 'resolved');
    } catch (error) {
      note('clipboardApi', `threw ${errText(error)}`);
    }
  };
  const viaExec = () => note('execCommand', copyWithExecCommand(SHARE_TEXT) ? 'returned true' : 'returned false');
  const viaShare = async () => {
    try {
      await showShareSheet({ title: 'DarnIt! #14', text: SHARE_TEXT });
      note('shareSheet', 'resolved');
    } catch (error) {
      note('shareSheet', `threw ${errText(error)}`);
    }
  };

  return (
    <Card n="2" title="Clipboard copy">
      <pre className="share">{SHARE_TEXT}</pre>
      <div className="row">
        <button onClick={() => void viaApi()}>A · Copy</button>
        <button onClick={viaExec}>B · Copy (legacy)</button>
        <button onClick={() => void viaShare()}>C · Share sheet</button>
      </div>
      <ul className="kv">
        {Object.entries(methods).map(([k, v]) => (
          <li key={k}>
            {k}: {v}
          </li>
        ))}
      </ul>
      <p className="hint">After each button, paste below. A match is recorded automatically.</p>
      <textarea
        className="paste"
        rows={3}
        placeholder="Paste here to check"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
      />
      <div className="row">
        <span className={matches ? 'result ok' : 'result'}>
          {matches ? `Paste matches (after ${last})` : 'No match yet'}
        </span>
        <button onClick={() => setPasted('')}>Clear</button>
      </div>
      <p className="hint">Fallback box. Press and hold to copy:</p>
      <textarea className="fallback" rows={3} readOnly value={SHARE_TEXT} />
      <Verdict
        spike="clipboard"
        yes="A copy button worked"
        no="Only press-and-hold worked"
        evidence={() => ({ methods, last, pasteMatched: matches })}
      />
    </Card>
  );
};

// --------------------------------------------------------------------- flair

const FlairCard = ({ init }: { init: InitResponse }) => {
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = async (action: 'set' | 'remove') => setResult(await postAction('/api/flair', { action }));
  return (
    <Card n="3" title="User flair">
      <p className="hint">
        Sets your flair in r/{init.subredditName} to “Apprentice · 7”. Then look at your name on
        any comment you have made here.
      </p>
      <div className="row">
        <button onClick={() => void run('set')}>Set my flair</button>
        <button onClick={() => void run('remove')}>Remove it</button>
      </div>
      <Result result={result} />
      <Verdict
        spike="flair"
        yes="Flair shows by my name"
        no="No flair visible"
        evidence={() => result}
      />
    </Card>
  );
};

// ------------------------------------------------------------------- comment

const CommentCard = () => {
  const [confirming, setConfirming] = useState<'top' | 'reply' | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [scope, setScope] = useState('not checked');
  const post = async (event: Event, mode: 'top' | 'reply') => {
    setConfirming(null);
    const granted = await canRunAsUser(event).then(String, (error: unknown) => `threw ${errText(error)}`);
    setScope(granted);
    setResult(await postAction('/api/comment', { mode, text: SHARE_TEXT }));
  };
  return (
    <Card n="4" title="Comment as you, after consent">
      <div className="row">
        <button onClick={() => setConfirming('top')}>Post to comments</button>
        <button onClick={() => setConfirming('reply')}>Reply under pinned comment</button>
      </div>
      {confirming ? (
        <div className="confirm">
          <p>
            Post your result as a {confirming === 'top' ? 'comment' : 'reply to the pinned comment'}{' '}
            from your account?
          </p>
          <pre className="share">{SHARE_TEXT}</pre>
          <div className="row">
            <button onClick={() => setConfirming(null)}>Cancel</button>
            <button className="primary" onClick={(e) => void post(e.nativeEvent, confirming)}>
              Yes, post it
            </button>
          </div>
        </div>
      ) : null}
      <p className="hint">canRunAsUser: {scope}</p>
      <Result result={result} />
      <Verdict
        spike="comment"
        yes="Comment is under my name"
        no="Wrong author or missing"
        evidence={() => ({ result, canRunAsUser: scope })}
      />
    </Card>
  );
};

// ------------------------------------------------------------- notifications

const NotifyCard = () => {
  const [log, setLog] = useState<ActionResult[]>([]);
  const run = async (action: string) => {
    const result = await postAction('/api/notify', { action });
    setLog((l) => [...l, { ...result, message: `${action}: ${result.message}` }]);
  };
  return (
    <Card n="5" title="Push notifications">
      <p className="hint">Opt in, send, then lock your phone for a minute.</p>
      <div className="row">
        <button onClick={() => void run('optin')}>1 · Opt in</button>
        <button onClick={() => void run('status')}>2 · Status</button>
        <button onClick={() => void run('send')}>3 · Send test</button>
      </div>
      <div className="row">
        <button onClick={() => void run('badge')}>Game badge</button>
        <button onClick={() => void run('optout')}>Opt out</button>
      </div>
      {log.map((r, i) => (
        <Result key={i} result={r} />
      ))}
      <Verdict
        spike="notifications"
        yes="It arrived and opened the post"
        no="Nothing arrived"
        evidence={() => log}
      />
    </Card>
  );
};

// ----------------------------------------------------------------- scheduler

const fmt = (ms: number) => `${ms >= 0 ? '+' : ''}${(ms / 1000).toFixed(1)} s`;
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 19);

const SchedulerCard = ({ initial }: { initial: SchedulerStatus }) => {
  const [status, setStatus] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler');
      const next: SchedulerStatus = await res.json();
      setStatus(next);
      void report('scheduler', 'info', {
        ticks: next.tickCount,
        tickMedianMs: Math.round(median(next.tickLatenessMs)),
        tickWorstMs: Math.round(Math.max(0, ...next.tickLatenessMs)),
        cronPosts: next.cronPosts,
        oneOffs: next.oneOffs,
      });
    } catch (error) {
      setResult({ ok: false, message: 'Refresh failed', detail: errText(error) });
    }
  }, []);
  const oneOff = async () => {
    setResult(await postAction('/api/scheduler/one-off', { delaySeconds: 60 }));
  };
  return (
    <Card n="6" title="Scheduler">
      <ul className="kv">
        <li>Server clock: {clock(status.serverNow)} UTC</li>
        <li>
          Every-minute cron: {status.tickCount} runs, median {fmt(median(status.tickLatenessMs))},
          worst {fmt(Math.max(0, ...status.tickLatenessMs))} after the minute
        </li>
        {status.cronPosts.map((p) => (
          <li key={p.postId}>
            Fixed-time post {p.slot} UTC fired {clock(p.firedAt)} ({fmt(p.lateMs)})
          </li>
        ))}
        {status.cronPosts.length === 0 ? <li>No fixed-time post has fired yet</li> : null}
        {status.oneOffs.map((o) => (
          <li key={o.firedAt}>
            One-off due {clock(o.runAt)} fired {clock(o.firedAt)} ({fmt(o.lateMs)})
          </li>
        ))}
      </ul>
      <div className="row">
        <button onClick={() => void oneOff()}>Schedule a one-off in 60 s</button>
        <button onClick={() => void refresh()}>Refresh</button>
      </div>
      <Result result={result} />
    </Card>
  );
};

// ----------------------------------------------------------------- snoovatar

const SnoovatarCard = ({ init }: { init: InitResponse }) => (
  <Card n="7" title="Snoovatar (bonus)">
    <div className="row avatars">
      <figure>
        {init.contextSnoovatar ? <img src={init.contextSnoovatar} alt="" /> : <div className="none">none</div>}
        <figcaption>context.snoovatar</figcaption>
      </figure>
      <figure>
        {init.apiSnoovatar ? <img src={init.apiSnoovatar} alt="" /> : <div className="none">none</div>}
        <figcaption>getSnoovatarUrl()</figcaption>
      </figure>
    </div>
    {init.apiSnoovatarError ? <p className="result bad">{init.apiSnoovatarError}</p> : null}
    <Verdict
      spike="snoovatar"
      yes="I see my avatar"
      no="No avatar shown"
      evidence={() => ({
        context: Boolean(init.contextSnoovatar),
        api: Boolean(init.apiSnoovatar),
        apiError: init.apiSnoovatarError,
      })}
    />
  </Card>
);

export const Checks = ({ init }: { init: InitResponse }) => (
  <div className="checks">
    <FontCard />
    <ClipboardCard />
    <FlairCard init={init} />
    <CommentCard />
    <NotifyCard />
    <SchedulerCard initial={init.scheduler} />
    <SnoovatarCard init={init} />
  </div>
);

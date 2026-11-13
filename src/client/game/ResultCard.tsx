// The solve card: time, badge, where the player placed, and share text to copy.
// SPEC "Results", item 1. Post to comments (P1) is not built yet.

import { useEffect, useRef, useState } from 'react';
import { badgeLabel, formatTime, shareText, standingLine } from '../../shared/api.ts';
import type { Badge, Standing } from '../../shared/api.ts';
import { Icon } from './Craft.tsx';

export type Result = {
  timeMs: number;
  hints: number;
  unpicks: number;
  badge: Badge;
  counted: boolean;
  standing: Standing | null;
  /** Why the result was not saved, if it was not. */
  note: string;
};

type Props = {
  day: number;
  subredditName: string;
  result: Result;
  /** In the flow of the Results page, rather than taped over the board. */
  inline?: boolean;
};

/** Older copy path for webviews that block the async clipboard API. */
const copyWithSelection = (text: string): boolean => {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
};

export const ResultCard = ({ day, subredditName, result, inline = false }: Props) => {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const text = shareText({
    day,
    timeMs: result.timeMs,
    badge: result.badge,
    unpicks: result.unpicks,
    standing: result.standing,
    subredditName,
  });
  const badge = badgeLabel(result.badge, result.unpicks);

  const onCopy = async () => {
    const done = await navigator.clipboard.writeText(text).then(
      () => true,
      () => copyWithSelection(text)
    );
    if (done) {
      setCopy('copied');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopy('idle'), 2000);
    } else {
      // Clipboard blocked: show the text so it can be selected by hand.
      setCopy('manual');
    }
  };

  return (
    <section className={inline ? 'note result inline' : 'note result'} aria-live="polite">
      <h2>
        #{day} stitched in {formatTime(result.timeMs)}
      </h2>
      {badge ? <p className="badge">{badge}</p> : null}
      {result.standing ? <p className="standing">{standingLine(result.standing, subredditName)}</p> : null}
      {result.note || !result.counted ? <p className="fine">{result.note || 'Practice pattern: not counted.'}</p> : null}
      {copy === 'manual' ? (
        <>
          <textarea className="share-text" readOnly rows={3} value={text} aria-label="Share text" />
          <p className="fine">Press and hold to copy.</p>
        </>
      ) : (
        <button type="button" className="patch cobalt" onClick={() => void onCopy()}>
          <Icon name="copy" />
          {copy === 'copied' ? 'Copied' : 'Copy result'}
        </button>
      )}
    </section>
  );
};

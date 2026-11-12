import { context, getWebViewMode } from '@devvit/web/client';
import type { ActionResult, Outcome, ReportRequest, SpikeId } from '../shared/api';

/** The exact share text from SPEC.md, so the clipboard spike copies the real thing. */
export const SHARE_TEXT = [
  'DarnIt! #14 · 0:48',
  'Faster than 75% of r/DarnItGame today',
  'Flawless · 12-day streak',
].join('\n');

/** Which Reddit client this is running in: the label every result is filed under. */
export const platform = (): string => {
  const native = context.client?.name;
  if (native === 'IOS') return 'ios-app';
  if (native === 'ANDROID') return 'android-app';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios-web';
  if (/Android/.test(ua)) return 'android-web';
  return 'desktop-web';
};

export const viewMode = (): string => {
  try {
    return getWebViewMode();
  } catch {
    return 'unknown';
  }
};

export const errText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

export const report = async (
  spike: SpikeId,
  outcome: Outcome,
  detail: unknown
): Promise<void> => {
  const body: ReportRequest = {
    spike,
    platform: platform(),
    outcome,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
  };
  try {
    await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('report failed', error);
  }
};

export const postAction = async (path: string, body: unknown): Promise<ActionResult> => {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}`, detail: await res.text() };
    }
    const data: ActionResult = await res.json();
    return data;
  } catch (error) {
    return { ok: false, message: 'Request failed', detail: errText(error) };
  }
};

/** Legacy copy path: works in some webviews where the async Clipboard API is blocked. */
export const copyWithExecCommand = (text: string): boolean => {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
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

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

export const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i] ?? 0;
};

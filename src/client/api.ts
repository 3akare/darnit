import type { HintResponse, StartResponse, SubmitResponse, TodayResponse } from '../shared/api.ts';

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: T = await res.json();
  return data;
};

export const fetchToday = async (): Promise<TodayResponse> => {
  const res = await fetch('/api/today');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: TodayResponse = await res.json();
  return data;
};

export const startRun = (): Promise<StartResponse> => post('/api/start', {});
export const askHint = (thread: readonly number[]): Promise<HintResponse> => post('/api/hint', { thread });
export const submitThread = (thread: readonly number[], unpicks: number): Promise<SubmitResponse> =>
  post('/api/submit', { thread, unpicks });

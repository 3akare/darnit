// The slice of Redis the game logic uses. Devvit's `redis` client fits this shape, and so
// does the in-memory store used by the tests and the off-Reddit preview.

export type Store = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  zAdd(key: string, ...members: { member: string; score: number }[]): Promise<unknown>;
  zScore(key: string, member: string): Promise<number | undefined>;
  /** 0-based position by ascending score, or undefined if absent. */
  zRank(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
  /** Members by ascending score, positions start to stop inclusive (-1 is the last). */
  zRange(key: string, start: number, stop: number): Promise<{ member: string; score: number }[]>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
};

export const createMemoryStore = (
  initial: Record<string, string> = {},
  onChange: (data: Record<string, string>) => void = () => {}
): Store => {
  const strings = new Map<string, string>(Object.entries(initial));
  const dump = (): void => onChange(Object.fromEntries(strings));
  const readSet = (key: string): Record<string, number> => {
    const raw = strings.get(key);
    return raw ? JSON.parse(raw) : {};
  };
  return {
    get: async (key) => strings.get(key),
    set: async (key, value) => {
      strings.set(key, value);
      dump();
    },
    del: async (...keys) => {
      for (const key of keys) strings.delete(key);
      dump();
    },
    zAdd: async (key, ...members) => {
      const set = readSet(key);
      for (const { member, score } of members) set[member] = score;
      strings.set(key, JSON.stringify(set));
      dump();
    },
    zScore: async (key, member) => readSet(key)[member],
    zRank: async (key, member) => {
      const set = readSet(key);
      if (!(member in set)) return undefined;
      const order = Object.entries(set).sort(([ma, a], [mb, b]) => a - b || (ma < mb ? -1 : ma > mb ? 1 : 0));
      return order.findIndex(([m]) => m === member);
    },
    zCard: async (key) => Object.keys(readSet(key)).length,
    zRange: async (key, start, stop) => {
      const order = Object.entries(readSet(key))
        .sort(([ma, a], [mb, b]) => a - b || (ma < mb ? -1 : ma > mb ? 1 : 0))
        .map(([member, score]) => ({ member, score }));
      const end = stop < 0 ? order.length + stop : stop;
      return order.slice(start, end + 1);
    },
    hIncrBy: async (key, field, value) => {
      const hash: Record<string, string> = JSON.parse(strings.get(key) ?? '{}');
      const next = Number(hash[field] ?? 0) + value;
      hash[field] = String(next);
      strings.set(key, JSON.stringify(hash));
      dump();
      return next;
    },
    hGetAll: async (key) => JSON.parse(strings.get(key) ?? '{}'),
  };
};

/**
 * Tiny in-memory cache so screens open instantly with the last data they
 * showed, then refresh in the background (stale-while-revalidate). Lives only
 * while the app is open; nothing is written to the device.
 */
export interface MemoStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  /** Runs `load` once per key at a time; concurrent callers share the same promise. */
  dedupe<T>(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createMemo(maxEntries = 50): MemoStore {
  const values = new Map<string, unknown>();
  const inflight = new Map<string, Promise<unknown>>();
  return {
    get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    set<T>(key: string, value: T) {
      values.delete(key);
      values.set(key, value);
      if (values.size > maxEntries) values.delete(values.keys().next().value as string);
    },
    dedupe<T>(key: string, load: () => Promise<T>) {
      const running = inflight.get(key);
      if (running) return running as Promise<T>;
      const p = load().finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    clear() {
      values.clear();
      inflight.clear();
    },
  };
}

/** The app-wide cache. Cleared on logout. */
export const memo = createMemo();

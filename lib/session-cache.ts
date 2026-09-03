const TTL_MS = 5 * 60 * 1000;

type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();

export function sessionCacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function sessionCacheSet<T>(key: string, value: T) {
  store.set(key, { at: Date.now(), value });
}

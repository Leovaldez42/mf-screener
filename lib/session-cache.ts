const TTL_MS = 5 * 60 * 1000;
const STORAGE_PREFIX = "mf-chase:sc:";

type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();

function readStorage(key: string): Entry | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    return JSON.parse(raw) as Entry;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, entry: Entry) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}

function isFresh(entry: Entry) {
  return Date.now() - entry.at <= TTL_MS;
}

export function sessionCacheGet<T>(key: string): T | undefined {
  const mem = store.get(key);
  if (mem) {
    if (!isFresh(mem)) {
      store.delete(key);
    } else {
      return mem.value as T;
    }
  }
  const disk = readStorage(key);
  if (!disk || !isFresh(disk)) {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(STORAGE_PREFIX + key);
      } catch {
        /* ignore */
      }
    }
    return undefined;
  }
  store.set(key, disk);
  return disk.value as T;
}

export function sessionCacheSet<T>(key: string, value: T) {
  const entry: Entry = { at: Date.now(), value };
  store.set(key, entry);
  writeStorage(key, entry);
}

export function chaseCacheKey(month: string) {
  return `chase:${month || "_"}`;
}

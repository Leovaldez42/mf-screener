import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

const KEY = "months";

let inflight: Promise<string[]> | null = null;

export function peekMonths(): string[] {
  return sessionCacheGet<string[]>(KEY) ?? [];
}

export function loadMonths(): Promise<string[]> {
  const hit = peekMonths();
  if (!inflight) {
    inflight = fetch("/api/v1/months")
      .then((r) => r.json())
      .then((d) => {
        const months = (d.months || []) as string[];
        if (months.length) sessionCacheSet(KEY, months);
        return months.length ? months : peekMonths();
      })
      .catch(() => peekMonths())
      .finally(() => {
        inflight = null;
      });
  }
  if (hit.length) return Promise.resolve(hit);
  return inflight;
}

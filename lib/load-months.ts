import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

const KEY = "months";

let inflight: Promise<string[]> | null = null;

export function loadMonths(): Promise<string[]> {
  const hit = sessionCacheGet<string[]>(KEY);
  if (hit) return Promise.resolve(hit);
  if (inflight) return inflight;
  inflight = fetch("/api/v1/months")
    .then((r) => r.json())
    .then((d) => {
      const months = (d.months || []) as string[];
      sessionCacheSet(KEY, months);
      return months;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

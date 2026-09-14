import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";
import type { HoldingsCoverage } from "@/lib/cached-holdings";

const KEY = "months";
const COV_KEY = "months-coverage";

let inflight: Promise<string[]> | null = null;

export function peekMonths(): string[] {
  return sessionCacheGet<string[]>(KEY) ?? [];
}

export function peekCoverage(): Record<string, HoldingsCoverage> {
  return sessionCacheGet<Record<string, HoldingsCoverage>>(COV_KEY) ?? {};
}

export function loadMonths(): Promise<string[]> {
  const hit = peekMonths();
  if (!inflight) {
    inflight = fetch("/api/v1/months")
      .then((r) => r.json())
      .then((d) => {
        const months = (d.months || []) as string[];
        if (months.length) sessionCacheSet(KEY, months);
        if (d.coverage && typeof d.coverage === "object") {
          sessionCacheSet(COV_KEY, d.coverage as Record<string, HoldingsCoverage>);
        }
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

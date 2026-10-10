import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";
import type { HoldingsCoverage } from "@/lib/cached-holdings";
import type { DataFreshness } from "@/lib/data-freshness";

const KEY = "months";
const COV_KEY = "months-coverage";

let inflight: Promise<string[]> | null = null;
let freshnessMem: DataFreshness | null = null;

export function peekMonths(): string[] {
  return sessionCacheGet<string[]>(KEY) ?? [];
}

export function peekCoverage(): Record<string, HoldingsCoverage> {
  return sessionCacheGet<Record<string, HoldingsCoverage>>(COV_KEY) ?? {};
}

export function peekFreshness(): DataFreshness | null {
  return freshnessMem;
}

export function loadMonths(): Promise<string[]> {
  const hit = peekMonths();
  if (!inflight) {
    inflight = fetch("/api/v1/months")
      .then((r) => r.json())
      .then((d) => {
        const months = (d.months || []) as string[];
        freshnessMem = {
          holdingsMonth: (d.holdingsMonth as string | null) ?? months[0] ?? null,
          returnsUpdated: (d.returnsUpdated as string | null) ?? null,
          stale: Boolean(d.stale),
        };
        if (d.coverage && typeof d.coverage === "object") {
          sessionCacheSet(COV_KEY, d.coverage as Record<string, HoldingsCoverage>);
        }
        if (months.length) sessionCacheSet(KEY, months);
        else sessionCacheSet(COV_KEY, peekCoverage());
        return months.length ? months : peekMonths();
      })
      .catch(() => peekMonths())
      .finally(() => {
        inflight = null;
      });
  }
  if (hit.length && peekFreshness()) return Promise.resolve(hit);
  return inflight;
}

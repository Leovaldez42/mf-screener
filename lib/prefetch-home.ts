import { chaseCacheKey, sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";
import { loadMonths } from "@/lib/load-months";
import type { ChaseRow } from "@/lib/types";

export function prefetchHomeData(month?: string) {
  const run = () => {
    void loadMonths()
      .then((months) => {
        const m = month || months[0] || "";
        const key = chaseCacheKey(m);
        if (sessionCacheGet(key)) return;
        const q = m ? `?month=${encodeURIComponent(m)}` : "";
        return fetch(`/api/v1/chase${q}`)
          .then(async (r) => {
            if (!r.ok) return;
            const d = await r.json();
            sessionCacheSet(key, (d.rows || []) as ChaseRow[]);
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(() => run(), { timeout: 1500 });
  } else {
    setTimeout(run, 1);
  }
}

import { chaseCacheKey, sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";
import { loadMonths } from "@/lib/load-months";
import type { ChaseRow } from "@/lib/types";

export const CHASE_PREVIEW_LIMIT = 80;

function putChase(month: string, rows: ChaseRow[]) {
  if (!month || !rows.length) return;
  const key = chaseCacheKey(month);
  const cur = sessionCacheGet<ChaseRow[]>(key);
  if (cur && cur.length >= rows.length) return;
  sessionCacheSet(key, rows);
  sessionCacheSet(chaseCacheKey(""), rows);
}

export function seedChasePreview(month: string, rows: ChaseRow[]) {
  putChase(month, rows);
}

export function chaseLooksComplete(rowCount: number) {
  return rowCount > CHASE_PREVIEW_LIMIT;
}

export async function loadChaseIntoCache(month: string, force = false) {
  const have = force ? 0 : (sessionCacheGet<ChaseRow[]>(chaseCacheKey(month))?.length ?? 0);
  if (!force && chaseLooksComplete(have)) return;
  const q = new URLSearchParams();
  if (month) q.set("month", month);
  const topQ = new URLSearchParams(q);
  topQ.set("limit", String(CHASE_PREVIEW_LIMIT));

  async function take(r: Response) {
    const d = await r.json();
    if (!r.ok && r.status !== 503) {
      throw new Error(d.error || "Failed to load");
    }
    if (r.ok) {
      putChase((d.month as string) || month, (d.rows || []) as ChaseRow[]);
    }
  }

  const top =
    have >= CHASE_PREVIEW_LIMIT && !force
      ? Promise.resolve()
      : fetch(`/api/v1/chase?${topQ}`, { cache: "default" }).then(take);
  const rest = fetch(`/api/v1/chase?${q}`, { cache: "default" }).then(take);
  await Promise.all([top, rest]);
}

export function prefetchHomeData(month?: string) {
  void loadMonths()
    .then((months) => {
      const m = month || months[0] || "";
      if (!m) return;
      return loadChaseIntoCache(m);
    })
    .catch(() => undefined);
}

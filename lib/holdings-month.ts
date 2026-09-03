import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { CACHE_TAG_HOLDINGS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import { createAnonClient } from "@/lib/supabase";

const LOOKBACK_MONTHS = 24;

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Last month whose AMC books are expected to be in. Before the 15th, prior month is still incomplete. */
export function lastCompletedYyyyMm(now = new Date()): string {
  const d = new Date(now);
  const shift = d.getDate() < 15 ? 2 : 1;
  d.setDate(1);
  d.setMonth(d.getMonth() - shift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLookback(end: string, count: number): string[] {
  const out: string[] = [];
  let cur = end;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    cur = previousMonth(cur);
  }
  return out;
}

async function queryCompleteMonths(): Promise<string[]> {
  const db = createAnonClient();
  const candidates = monthLookback(lastCompletedYyyyMm(), LOOKBACK_MONTHS);
  const counts = await Promise.all(
    candidates.map(async (month) => {
      const { count, error } = await db
        .from("holdings_snapshots")
        .select("month", { count: "exact", head: true })
        .eq("month", month);
      if (error) throw new Error(error.message || "holdings_month_count_failed");
      return { month, count: count ?? 0 };
    }),
  );
  return counts.filter((row) => row.count > 0).map((row) => row.month);
}

const cachedCompleteMonths = unstable_cache(queryCompleteMonths, ["complete-months"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

/** Months that have actual holdings books, not phantom “all sold” diffs from a missing disclosure. */
export async function listCompleteMonths(_db?: SupabaseClient): Promise<string[]> {
  return cachedCompleteMonths();
}

export async function latestCompleteMonth(db: SupabaseClient): Promise<string | null> {
  const months = await listCompleteMonths(db);
  return months[0] ?? null;
}

export async function listFamilyMonths(
  db: SupabaseClient,
  familyId: number,
  complete: string[],
): Promise<string[]> {
  if (!complete.length) return [];
  const found: string[] = [];
  const page = 1000;
  for (let from = 0; from < 20000; from += page) {
    const { data, error } = await db
      .from("holdings_snapshots")
      .select("month")
      .eq("family_id", familyId)
      .in("month", complete)
      .order("month", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      if (row.month) found.push(row.month as string);
    }
    if (data.length < page) break;
  }
  return [...new Set(found)].sort((a, b) => b.localeCompare(a));
}

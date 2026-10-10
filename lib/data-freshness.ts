import { unstable_cache } from "next/cache";
import { listCompleteMonths } from "@/lib/holdings-month";
import { holdingsAreStale } from "@/lib/holdings-month-pick";
import { CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import { createAnonClient } from "@/lib/supabase";

export type DataFreshness = {
  holdingsMonth: string | null;
  returnsUpdated: string | null;
  stale: boolean;
};

async function loadDataFreshness(): Promise<DataFreshness> {
  const months = await listCompleteMonths();
  const holdingsMonth = months[0] ?? null;
  const db = createAnonClient();
  const { data, error } = await db
    .from("scheme_metrics")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const returnsUpdated = data?.fetched_at ? String(data.fetched_at) : null;
  return {
    holdingsMonth,
    returnsUpdated,
    stale: holdingsMonth ? holdingsAreStale(holdingsMonth) : false,
  };
}

export const getDataFreshness = unstable_cache(loadDataFreshness, ["data-freshness-v1"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS],
});

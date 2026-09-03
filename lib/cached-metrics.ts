import { unstable_cache } from "next/cache";
import { equalWeightCategoryAverages, type SchemeMetric } from "@/lib/scheme-metrics";
import { CACHE_TAG_METRICS, METRICS_REVALIDATE_SEC } from "@/lib/http-cache";
import { createAnonClient } from "@/lib/supabase";

async function loadScreenerUniverse() {
  const db = createAnonClient();
  const { data: peerRows, error: peerErr } = await db
    .from("scheme_metrics")
    .select("*")
    .eq("is_direct", true)
    .eq("is_growth", true)
    .eq("is_active_equity", true)
    .limit(2000);
  if (peerErr) throw new Error(peerErr.message);

  const { count, error: countErr } = await db
    .from("scheme_metrics")
    .select("scheme_code", { count: "exact", head: true })
    .eq("is_direct", true)
    .eq("is_growth", true)
    .eq("is_active_equity", true);
  if (countErr) throw new Error(countErr.message);

  const peers = (peerRows || []) as SchemeMetric[];
  return {
    peers,
    houses: [...new Set(peers.map((r) => String(r.fund_house)).filter(Boolean))].sort(),
    categoryAverages: equalWeightCategoryAverages(peers),
    universe: count ?? peers.length,
  };
}

export const getScreenerUniverse = unstable_cache(loadScreenerUniverse, ["screener-universe"], {
  revalidate: METRICS_REVALIDATE_SEC,
  tags: [CACHE_TAG_METRICS],
});

async function loadSchemePage(code: string) {
  const db = createAnonClient();
  const { data, error } = await db.from("scheme_metrics").select("*").eq("scheme_code", code).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: "not_found" as const };

  const category = String((data as SchemeMetric).category || "");
  let categoryAverage = null;
  if (category) {
    const { data: peers, error: peerErr } = await db
      .from("scheme_metrics")
      .select("*")
      .eq("is_direct", true)
      .eq("is_growth", true)
      .eq("is_active_equity", true)
      .eq("category", category)
      .limit(2000);
    if (peerErr) throw new Error(peerErr.message);
    categoryAverage = equalWeightCategoryAverages((peers || []) as SchemeMetric[])[category] || null;
  }

  return { scheme: data, categoryAverage };
}

export const getSchemePage = unstable_cache(loadSchemePage, ["scheme-page"], {
  revalidate: METRICS_REVALIDATE_SEC,
  tags: [CACHE_TAG_METRICS],
});

import { unstable_cache } from "next/cache";
import { equalWeightCategoryAverages, type SchemeMetric } from "@/lib/scheme-metrics";
import {
  CLASS_STYLES,
  classStylesOrFilter,
  parseAssetClass,
  parseStyleIds,
  type AssetClassId,
} from "@/lib/fund-class";
import { CACHE_TAG_METRICS, METRICS_REVALIDATE_SEC } from "@/lib/http-cache";
import { createAnonClient } from "@/lib/supabase";

const UNIVERSE_LIMIT = 8000;

async function loadScreenerUniverse() {
  const db = createAnonClient();
  const { data: peerRows, error: peerErr } = await db
    .from("scheme_metrics")
    .select("*")
    .eq("is_direct", true)
    .eq("is_growth", true)
    .limit(UNIVERSE_LIMIT);
  if (peerErr) throw new Error(peerErr.message);

  const { count, error: countErr } = await db
    .from("scheme_metrics")
    .select("scheme_code", { count: "exact", head: true })
    .eq("is_direct", true)
    .eq("is_growth", true);
  if (countErr) throw new Error(countErr.message);

  const peers = (peerRows || []) as SchemeMetric[];
  return {
    peers,
    universe: count ?? peers.length,
  };
}

export const getScreenerUniverse = unstable_cache(loadScreenerUniverse, ["screener-universe-all"], {
  revalidate: METRICS_REVALIDATE_SEC,
  tags: [CACHE_TAG_METRICS],
});

export function universeForClass(peers: SchemeMetric[], assetClass: AssetClassId) {
  const classPeers = peers.filter((r) => (r.asset_class || parseAssetClass(r.asset_class)) === assetClass);
  return {
    peers: classPeers,
    houses: [...new Set(classPeers.map((r) => String(r.fund_house)).filter(Boolean))].sort(),
    categoryAverages: equalWeightCategoryAverages(classPeers),
    styles: CLASS_STYLES[assetClass].map((s) => ({ id: s.id, label: s.label })),
    universe: classPeers.length,
  };
}

export function styleAverageForClass(
  classPeers: SchemeMetric[],
  assetClass: AssetClassId,
  styleIds: string | string[],
) {
  const ids = Array.isArray(styleIds) ? styleIds : parseStyleIds(styleIds);
  const needles = classStylesOrFilter(assetClass, ids);
  if (!needles.length) return null;
  const stylePeers = classPeers.filter((r) => {
    const blob = `${r.name || ""} ${r.category || ""}`.toLowerCase();
    return needles.some((n) => blob.includes(n));
  });
  const grouped = equalWeightCategoryAverages(stylePeers.map((r) => ({ ...r, category: "__style__" })));
  return grouped["__style__"]
    ? { ...grouped["__style__"], category: ids.join(","), n: stylePeers.length }
    : null;
}

async function loadSchemePage(code: string) {
  const db = createAnonClient();
  const { data, error } = await db.from("scheme_metrics").select("*").eq("scheme_code", code).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: "not_found" as const };

  const scheme = data as SchemeMetric;
  const category = String(scheme.category || "");
  const assetClass = parseAssetClass(scheme.asset_class);
  let categoryAverage = null;
  if (category) {
    const { data: peers, error: peerErr } = await db
      .from("scheme_metrics")
      .select("*")
      .eq("is_direct", true)
      .eq("is_growth", true)
      .eq("asset_class", assetClass)
      .eq("category", category)
      .limit(UNIVERSE_LIMIT);
    if (peerErr) throw new Error(peerErr.message);
    categoryAverage = equalWeightCategoryAverages((peers || []) as SchemeMetric[])[category] || null;
  }

  return { scheme, categoryAverage };
}

export const getSchemePage = unstable_cache(loadSchemePage, ["scheme-page"], {
  revalidate: METRICS_REVALIDATE_SEC,
  tags: [CACHE_TAG_METRICS],
});

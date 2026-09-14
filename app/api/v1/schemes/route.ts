import { NextRequest } from "next/server";
import {
  getScreenerUniverse,
  styleAverageForClass,
  universeForClass,
} from "@/lib/cached-metrics";
import {
  CLASS_STYLES,
  classStylesOrFilter,
  parseAssetClass,
  parseStyleIds,
  searchNeedles,
  styleMatchOrFilter,
} from "@/lib/fund-class";
import { METRICS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { SORTABLE, type SortKey } from "@/lib/scheme-metrics";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const revalidate = 120;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured" }, 503);
  }
  const sp = req.nextUrl.searchParams;
  const assetClass = parseAssetClass(sp.get("class"));
  const q = (sp.get("q") || "").replace(/[%(),]/g, "").trim().slice(0, 80);
  const house = (sp.get("house") || "").trim();
  const category = (sp.get("category") || "").trim();
  const styleIds = parseStyleIds(sp.get("style") || sp.get("styles"));
  const minSharpe = sp.get("minSharpe");
  const maxExpense = sp.get("maxExpense");
  const maxPe = sp.get("maxPe");
  const minCagr1y = sp.get("minCagr1y");
  const minCagr3y = sp.get("minCagr3y");
  const minCagrInception = sp.get("minCagrInception");
  const minAum = sp.get("minAum");
  const maxAum = sp.get("maxAum");
  const sort = (sp.get("sort") || "sharpe_3y") as SortKey;
  const order = sp.get("order") === "asc" ? true : false;
  const limit = Math.min(800, Math.max(1, Number(sp.get("limit") || "150")));

  const db = createAnonClient();
  let query = db
    .from("scheme_metrics")
    .select("*")
    .eq("is_direct", true)
    .eq("is_growth", true);

  const classParam = sp.get("class");
  const browseAll = classParam === "all";
  const searchAllClasses = Boolean(q) || browseAll;
  if (!searchAllClasses) query = query.eq("asset_class", assetClass);

  if (house) query = query.eq("fund_house", house);
  const styleClass = browseAll ? "equity-active" : assetClass;
  const needles = classStylesOrFilter(styleClass, styleIds);
  if (needles.length) query = query.or(styleMatchOrFilter(needles));
  else if (category && !browseAll) query = query.ilike("category", `%${category}%`);
  if (q) {
    const ors = searchNeedles(q).flatMap((n) => [`name.ilike.%${n}%`, `fund_house.ilike.%${n}%`]);
    query = query.or(ors.join(","));
  }
  if (minSharpe) query = query.gte("sharpe_3y", Number(minSharpe));
  if (maxExpense) query = query.lte("expense_ratio", Number(maxExpense));
  if (maxPe) query = query.lte("pe", Number(maxPe));
  if (minCagr1y) query = query.gte("cagr_1y", Number(minCagr1y));
  if (minCagr3y) query = query.gte("cagr_3y", Number(minCagr3y));
  if (minCagrInception) query = query.gte("cagr_inception", Number(minCagrInception));
  if (minAum) query = query.gte("aum_cr", Number(minAum));
  if (maxAum) query = query.lte("aum_cr", Number(maxAum));

  const sortKey = SORTABLE.includes(sort) ? sort : "sharpe_3y";
  query = query.order(sortKey, { ascending: order, nullsFirst: false }).limit(limit);

  const { data, error } = await query;
  if (error) return jsonNoStore({ error: error.message }, 500);

  let countQuery = db
    .from("scheme_metrics")
    .select("scheme_code", { count: "exact", head: true })
    .eq("is_direct", true)
    .eq("is_growth", true);
  if (!searchAllClasses) countQuery = countQuery.eq("asset_class", assetClass);
  if (house) countQuery = countQuery.eq("fund_house", house);
  if (needles.length) countQuery = countQuery.or(styleMatchOrFilter(needles));
  else if (category && !browseAll) countQuery = countQuery.ilike("category", `%${category}%`);
  if (q) {
    const ors = searchNeedles(q).flatMap((n) => [`name.ilike.%${n}%`, `fund_house.ilike.%${n}%`]);
    countQuery = countQuery.or(ors.join(","));
  }
  if (minSharpe) countQuery = countQuery.gte("sharpe_3y", Number(minSharpe));
  if (maxExpense) countQuery = countQuery.lte("expense_ratio", Number(maxExpense));
  if (maxPe) countQuery = countQuery.lte("pe", Number(maxPe));
  if (minCagr1y) countQuery = countQuery.gte("cagr_1y", Number(minCagr1y));
  if (minCagr3y) countQuery = countQuery.gte("cagr_3y", Number(minCagr3y));
  if (minCagrInception) countQuery = countQuery.gte("cagr_inception", Number(minCagrInception));
  if (minAum) countQuery = countQuery.gte("aum_cr", Number(minAum));
  if (maxAum) countQuery = countQuery.lte("aum_cr", Number(maxAum));
  const { count: matchedCount, error: countErr } = await countQuery;
  if (countErr) return jsonNoStore({ error: countErr.message }, 500);
  const matched = matchedCount ?? (data || []).length;

  let universe;
  try {
    universe = await getScreenerUniverse();
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "schemes_failed" }, 500);
  }

  const scoped = universeForClass(universe.peers, assetClass);
  const allHouses = [...new Set(universe.peers.map((r) => String(r.fund_house)).filter(Boolean))].sort();
  const stylePeers = browseAll ? universe.peers : scoped.peers;
  const styleAverage = styleIds.length
    ? styleAverageForClass(stylePeers, browseAll ? "equity-active" : assetClass, styleIds)
    : null;
  const styles = browseAll
    ? CLASS_STYLES["equity-active"].map((s) => ({ id: s.id, label: s.label }))
    : scoped.styles;

  return jsonCached(
    {
      schemes: data || [],
      class: searchAllClasses ? "all" : assetClass,
      searchAllClasses,
      houses: browseAll ? allHouses : scoped.houses,
      styles,
      categoryAverages: scoped.categoryAverages,
      styleAverage,
      total: (data || []).length,
      matched,
      universe: Math.max(matched, (data || []).length),
    },
    METRICS_CACHE_CONTROL,
  );
}

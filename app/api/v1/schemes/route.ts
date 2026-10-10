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
import { compareInceptionCagr, withInceptionCagrFlag } from "@/lib/inception-cagr";
import { SORTABLE, type SchemeMetric, type SortKey } from "@/lib/scheme-metrics";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const revalidate = 120;

type FilterOpts = {
  searchAllClasses: boolean;
  assetClass: ReturnType<typeof parseAssetClass>;
  house: string;
  needles: string[];
  category: string;
  browseAll: boolean;
  q: string;
  minSharpe: string | null;
  maxExpense: string | null;
  maxPe: string | null;
  minCagr1y: string | null;
  minCagr3y: string | null;
  minCagrInception: string | null;
  minAum: string | null;
  maxAum: string | null;
  hideDefault: boolean;
};

function applySchemeFilters<Q>(query: Q, opts: FilterOpts): Q {
  type Chain = {
    eq: (column: string, value: unknown) => Chain;
    or: (filters: string) => Chain;
    ilike: (column: string, pattern: string) => Chain;
    gte: (column: string, value: number) => Chain;
    lte: (column: string, value: number) => Chain;
    not: (column: string, operator: string, value: unknown) => Chain;
  };
  let q = query as unknown as Chain;
  if (!opts.searchAllClasses) q = q.eq("asset_class", opts.assetClass);
  if (opts.house) q = q.eq("fund_house", opts.house);
  if (opts.needles.length) q = q.or(styleMatchOrFilter(opts.needles));
  else if (opts.category && !opts.browseAll) q = q.ilike("category", `%${opts.category}%`);
  if (opts.q) {
    const ors = searchNeedles(opts.q).flatMap((n) => [`name.ilike.%${n}%`, `fund_house.ilike.%${n}%`]);
    q = q.or(ors.join(","));
  }
  if (opts.minSharpe) q = q.gte("sharpe_3y", Number(opts.minSharpe));
  if (opts.maxExpense) q = q.lte("expense_ratio", Number(opts.maxExpense));
  if (opts.maxPe) q = q.lte("pe", Number(opts.maxPe));
  if (opts.minCagr1y) q = q.gte("cagr_1y", Number(opts.minCagr1y));
  if (opts.minCagr3y) q = q.gte("cagr_3y", Number(opts.minCagr3y));
  if (opts.minCagrInception) q = q.gte("cagr_inception", Number(opts.minCagrInception));
  if (opts.minAum) q = q.gte("aum_cr", Number(opts.minAum));
  if (opts.maxAum) q = q.lte("aum_cr", Number(opts.maxAum));
  if (opts.hideDefault) {
    q = q.not("aum_cr", "is", null).not("name", "ilike", "%Unclaimed%");
  }
  return q as unknown as Q;
}

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
  const showAll = sp.get("showAll") === "1";

  const classParam = sp.get("class");
  const browseAll = classParam === "all";
  const searchAllClasses = Boolean(q) || browseAll;
  const styleClass = browseAll ? "equity-active" : assetClass;
  const needles = classStylesOrFilter(styleClass, styleIds);
  const sortKey = SORTABLE.includes(sort) ? sort : "sharpe_3y";

  const filters: Omit<FilterOpts, "hideDefault"> = {
    searchAllClasses,
    assetClass,
    house,
    needles,
    category,
    browseAll,
    q,
    minSharpe,
    maxExpense,
    maxPe,
    minCagr1y,
    minCagr3y,
    minCagrInception,
    minAum,
    maxAum,
  };

  const db = createAnonClient();
  const query = applySchemeFilters(
    db.from("scheme_metrics").select("*").eq("is_direct", true).eq("is_growth", true),
    { ...filters, hideDefault: !showAll },
  )
    .order(sortKey, { ascending: order, nullsFirst: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) return jsonNoStore({ error: error.message }, 500);

  async function countRows(hideDefault: boolean) {
    const { count, error: countErr } = await applySchemeFilters(
      db.from("scheme_metrics").select("scheme_code", { count: "exact", head: true }).eq("is_direct", true).eq("is_growth", true),
      { ...filters, hideDefault },
    );
    return { count, error: countErr };
  }

  const all = await countRows(false);
  if (all.error) return jsonNoStore({ error: all.error.message }, 500);
  const shown = showAll ? all : await countRows(true);
  if (shown.error) return jsonNoStore({ error: shown.error.message }, 500);

  const matchedAll = all.count ?? (data || []).length;
  const matchedShown = shown.count ?? (data || []).length;
  const hiddenCount = Math.max(0, matchedAll - matchedShown);
  const matched = showAll ? matchedAll : matchedShown;

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

  let schemes = ((data || []) as SchemeMetric[]).map((row) => withInceptionCagrFlag(row));
  if (sortKey === "cagr_inception") {
    schemes = [...schemes].sort((a, b) => compareInceptionCagr(a, b, order));
  }

  return jsonCached(
    {
      schemes,
      class: searchAllClasses ? "all" : assetClass,
      searchAllClasses,
      houses: browseAll ? allHouses : scoped.houses,
      styles,
      categoryAverages: scoped.categoryAverages,
      styleAverage,
      total: schemes.length,
      matched,
      hiddenCount,
      showAll,
      universe: Math.max(matched, schemes.length),
    },
    METRICS_CACHE_CONTROL,
  );
}

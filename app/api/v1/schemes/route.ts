import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_STYLES, categoryStyleOrFilter } from "@/lib/equity";
import {
  equalWeightCategoryAverages,
  SORTABLE,
  type SchemeMetric,
  type SortKey,
} from "@/lib/scheme-metrics";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").replace(/[%(),]/g, "").trim().slice(0, 80);
  const house = (sp.get("house") || "").trim();
  const category = (sp.get("category") || "").trim();
  const style = (sp.get("style") || "").trim();
  const minSharpe = sp.get("minSharpe");
  const maxSharpe = sp.get("maxSharpe");
  const minExpense = sp.get("minExpense");
  const maxExpense = sp.get("maxExpense");
  const minCagr1y = sp.get("minCagr1y");
  const maxCagr1y = sp.get("maxCagr1y");
  const minCagr3y = sp.get("minCagr3y");
  const maxCagr3y = sp.get("maxCagr3y");
  const minCagrInception = sp.get("minCagrInception");
  const maxCagrInception = sp.get("maxCagrInception");
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
    .eq("is_growth", true)
    .eq("is_active_equity", true);

  if (house) query = query.eq("fund_house", house);
  const needles = categoryStyleOrFilter(style);
  if (needles.length === 1) query = query.ilike("category", `%${needles[0]}%`);
  else if (needles.length > 1) {
    query = query.or(needles.map((n) => `category.ilike.%${n}%`).join(","));
  } else if (category) query = query.ilike("category", `%${category}%`);
  if (q) query = query.or(`name.ilike.%${q}%,fund_house.ilike.%${q}%`);
  if (minSharpe) query = query.gte("sharpe_3y", Number(minSharpe));
  if (maxSharpe) query = query.lte("sharpe_3y", Number(maxSharpe));
  if (minExpense) query = query.gte("expense_ratio", Number(minExpense));
  if (maxExpense) query = query.lte("expense_ratio", Number(maxExpense));
  if (minCagr1y) query = query.gte("cagr_1y", Number(minCagr1y));
  if (maxCagr1y) query = query.lte("cagr_1y", Number(maxCagr1y));
  if (minCagr3y) query = query.gte("cagr_3y", Number(minCagr3y));
  if (maxCagr3y) query = query.lte("cagr_3y", Number(maxCagr3y));
  if (minCagrInception) query = query.gte("cagr_inception", Number(minCagrInception));
  if (maxCagrInception) query = query.lte("cagr_inception", Number(maxCagrInception));
  if (minAum) query = query.gte("aum_cr", Number(minAum));
  if (maxAum) query = query.lte("aum_cr", Number(maxAum));

  const sortKey = SORTABLE.includes(sort) ? sort : "sharpe_3y";
  query = query.order(sortKey, { ascending: order, nullsFirst: false }).limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: peerRows, error: peerErr } = await db
    .from("scheme_metrics")
    .select("*")
    .eq("is_direct", true)
    .eq("is_growth", true)
    .eq("is_active_equity", true)
    .limit(2000);
  if (peerErr) return NextResponse.json({ error: peerErr.message }, { status: 500 });

  const peers = (peerRows || []) as SchemeMetric[];
  const categoryAverages = equalWeightCategoryAverages(peers);
  const houses = [...new Set(peers.map((r) => String(r.fund_house)).filter(Boolean))].sort();

  let styleAverage = null;
  if (needles.length) {
    const stylePeers = peers.filter((r) => {
      const c = (r.category || "").toLowerCase();
      return needles.some((n) => c.includes(n));
    });
    const grouped = equalWeightCategoryAverages(
      stylePeers.map((r) => ({ ...r, category: "__style__" })),
    );
    styleAverage = grouped["__style__"]
      ? { ...grouped["__style__"], category: style, n: stylePeers.length }
      : null;
  }

  const { count } = await db
    .from("scheme_metrics")
    .select("scheme_code", { count: "exact", head: true })
    .eq("is_direct", true)
    .eq("is_growth", true)
    .eq("is_active_equity", true);

  return NextResponse.json({
    schemes: data || [],
    houses,
    styles: CATEGORY_STYLES.map((s) => ({ id: s.id, label: s.label })),
    categoryAverages,
    styleAverage,
    total: (data || []).length,
    universe: count ?? peers.length,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_STYLES, categoryStyleOrFilter } from "@/lib/equity";
import { SORTABLE, type SortKey } from "@/lib/scheme-metrics";
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
  const minCagr3y = sp.get("minCagr3y");
  const maxCagr3y = sp.get("maxCagr3y");
  const minAum = sp.get("minAum");
  const sort = (sp.get("sort") || "sharpe_3y") as SortKey;
  const order = sp.get("order") === "asc" ? true : false;
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit") || "150")));

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
  if (minCagr3y) query = query.gte("cagr_3y", Number(minCagr3y));
  if (maxCagr3y) query = query.lte("cagr_3y", Number(maxCagr3y));
  if (minAum) query = query.gte("aum_cr", Number(minAum));

  const sortKey = SORTABLE.includes(sort) ? sort : "sharpe_3y";
  query = query.order(sortKey, { ascending: order, nullsFirst: false }).limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: houseRows } = await db
    .from("scheme_metrics")
    .select("fund_house")
    .eq("is_direct", true)
    .eq("is_growth", true)
    .eq("is_active_equity", true);

  const houses = [...new Set((houseRows || []).map((r) => String(r.fund_house)).filter(Boolean))].sort();

  return NextResponse.json({
    schemes: data || [],
    houses,
    styles: CATEGORY_STYLES.map((s) => ({ id: s.id, label: s.label })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";
import { asOne } from "@/lib/rel";
import type { ChaseRow } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured", rows: [] }, { status: 503 });
  }
  const month = req.nextUrl.searchParams.get("month");
  const sector = req.nextUrl.searchParams.get("sector");
  const minFunds = Number(req.nextUrl.searchParams.get("min_funds") || "0");
  const sort = req.nextUrl.searchParams.get("sort") || "abs_value";

  const db = createAnonClient();
  let monthToUse = month;
  if (!monthToUse) {
    const { data: latest } = await db
      .from("stock_month_aggregates")
      .select("month")
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
    monthToUse = latest?.month ?? null;
  }
  if (!monthToUse) {
    return NextResponse.json({ month: null, rows: [] as ChaseRow[] });
  }

  const { data, error } = await db
    .from("stock_month_aggregates")
    .select(
      "stock_id, fund_count, fund_count_delta, net_qty_delta, net_value_delta_cr, median_weight_pct, stocks(display_name, sector)"
    )
    .eq("month", monthToUse);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows: ChaseRow[] = (data || []).map((r) => {
    const stock = asOne(r.stocks);
    return {
      stock_id: r.stock_id as string,
      display_name: String(stock?.display_name ?? "Unknown"),
      sector: (stock?.sector as string | null) ?? null,
      fund_count: Number(r.fund_count),
      fund_count_delta: Number(r.fund_count_delta),
      net_qty_delta: Number(r.net_qty_delta),
      net_value_delta_cr: Number(r.net_value_delta_cr),
      median_weight_pct: r.median_weight_pct == null ? null : Number(r.median_weight_pct),
    };
  });

  if (sector) {
    rows = rows.filter((r) => (r.sector || "").toLowerCase() === sector.toLowerCase());
  }
  if (minFunds > 0) {
    rows = rows.filter((r) => r.fund_count >= minFunds);
  }

  rows.sort((a, b) => {
    if (sort === "fund_delta") return Math.abs(b.fund_count_delta) - Math.abs(a.fund_count_delta);
    return Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr);
  });

  return NextResponse.json({ month: monthToUse, rows });
}

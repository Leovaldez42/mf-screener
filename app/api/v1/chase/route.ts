import { NextRequest, NextResponse } from "next/server";
import { listCompleteMonths } from "@/lib/holdings-month";
import { createAnonClient, fetchAllRows, supabaseConfigured } from "@/lib/supabase";
import { asOne } from "@/lib/rel";
import type { ChaseRow } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured", rows: [] }, { status: 503 });
  }
  const month = req.nextUrl.searchParams.get("month");
  const sector = req.nextUrl.searchParams.get("sector");
  const minFunds = Number(req.nextUrl.searchParams.get("min_funds") || "0");
  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  const db = createAnonClient();
  const complete = await listCompleteMonths(db);
  const monthToUse = month && complete.includes(month) ? month : complete[0] ?? null;
  if (!monthToUse) {
    return NextResponse.json({ month: null, rows: [] as ChaseRow[] });
  }

  type AggRow = {
    stock_id: string;
    fund_count: number;
    fund_count_delta: number;
    net_qty_delta: number;
    net_value_delta_cr: number;
    median_weight_pct: number | null;
    stocks: unknown;
  };

  let data: AggRow[];
  try {
    data = await fetchAllRows<AggRow>(() => {
      let q = db
        .from("stock_month_aggregates")
        .select(
          "stock_id, fund_count, fund_count_delta, net_qty_delta, net_value_delta_cr, median_weight_pct, stocks(display_name, sector)",
        )
        .eq("month", monthToUse);
      if (ids.length) q = q.in("stock_id", ids);
      return q;
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chase_failed" }, { status: 500 });
  }

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

  if (ids.length) {
    const have = new Set(rows.map((r) => r.stock_id));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length) {
      const { data: stocks } = await db.from("stocks").select("id, display_name, sector").in("id", missing);
      for (const s of stocks || []) {
        rows.push({
          stock_id: s.id as string,
          display_name: String(s.display_name),
          sector: (s.sector as string | null) ?? null,
          fund_count: 0,
          fund_count_delta: 0,
          net_qty_delta: 0,
          net_value_delta_cr: 0,
          median_weight_pct: null,
        });
      }
    }
    const order = new Map(ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.stock_id) ?? 999) - (order.get(b.stock_id) ?? 999));
  } else {
    rows.sort((a, b) => Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr));
  }

  return NextResponse.json({ month: monthToUse, rows });
}

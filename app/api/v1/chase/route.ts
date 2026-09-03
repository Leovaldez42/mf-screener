import { NextRequest } from "next/server";
import { getChaseRows, resolveHoldingsMonth } from "@/lib/cached-holdings";
import { HOLDINGS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";
import type { ChaseRow } from "@/lib/types";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured", rows: [] }, 503);
  }
  const month = req.nextUrl.searchParams.get("month");
  const sector = req.nextUrl.searchParams.get("sector");
  const minFunds = Number(req.nextUrl.searchParams.get("min_funds") || "0");
  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  let monthToUse: string | null;
  let data: ChaseRow[];
  try {
    monthToUse = await resolveHoldingsMonth(month);
    if (!monthToUse) return jsonCached({ month: null, rows: [] as ChaseRow[] }, HOLDINGS_CACHE_CONTROL);
    data = await getChaseRows(monthToUse);
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "chase_failed" }, 500);
  }

  let rows = data;
  if (sector) {
    rows = rows.filter((r) => (r.sector || "").toLowerCase() === sector.toLowerCase());
  }
  if (minFunds > 0) {
    rows = rows.filter((r) => r.fund_count >= minFunds);
  }

  if (ids.length) {
    const byId = new Map(rows.map((r) => [r.stock_id, r]));
    rows = ids.map((id) => byId.get(id)).filter((r): r is ChaseRow => Boolean(r));
    const have = new Set(rows.map((r) => r.stock_id));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length) {
      const db = createAnonClient();
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

  return jsonCached({ month: monthToUse, rows }, HOLDINGS_CACHE_CONTROL);
}

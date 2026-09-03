import { NextRequest, NextResponse } from "next/server";
import { listCompleteMonths } from "@/lib/holdings-month";
import { createAnonClient, fetchAllRows, supabaseConfigured } from "@/lib/supabase";
import { asOne } from "@/lib/rel";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured", rows: [] }, { status: 503 });
  }
  const month = req.nextUrl.searchParams.get("month");
  const db = createAnonClient();

  const complete = await listCompleteMonths(db);
  const monthToUse = month && complete.includes(month) ? month : complete[0] ?? null;
  if (!monthToUse) return NextResponse.json({ month: null, rows: [] });

  type DiffRow = { value_delta_cr: number; qty_delta: number; stocks: unknown };
  let data: DiffRow[];
  try {
    data = await fetchAllRows<DiffRow>(() =>
      db.from("holding_diffs").select("value_delta_cr, qty_delta, stocks(sector)").eq("month", monthToUse),
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "sectors_failed" }, { status: 500 });
  }

  const map = new Map<string, { net_value_delta_cr: number; net_qty_delta: number }>();
  for (const row of data || []) {
    const st = asOne(row.stocks);
    const key = String(st?.sector || "Unknown");
    const cur = map.get(key) || { net_value_delta_cr: 0, net_qty_delta: 0 };
    cur.net_value_delta_cr += Number(row.value_delta_cr);
    cur.net_qty_delta += Number(row.qty_delta);
    map.set(key, cur);
  }

  const rows = [...map.entries()]
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr));

  return NextResponse.json({ month: monthToUse, rows });
}

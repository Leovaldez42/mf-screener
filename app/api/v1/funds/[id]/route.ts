import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";
import { asOne } from "@/lib/rel";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const { id } = await params;
  const familyId = Number(id);
  if (!Number.isFinite(familyId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const month = req.nextUrl.searchParams.get("month");
  const db = createAnonClient();

  const { data: family, error } = await db.from("families").select("*").eq("id", familyId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!family) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let monthToUse = month || family.latest_month;
  if (!monthToUse) {
    const { data: latest } = await db
      .from("holdings_snapshots")
      .select("month")
      .eq("family_id", familyId)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
    monthToUse = latest?.month;
  }

  const { data: snaps } = await db
    .from("holdings_snapshots")
    .select("stock_id, quantity, market_value_cr, weight_pct, stocks(display_name, sector)")
    .eq("family_id", familyId)
    .eq("month", monthToUse);

  const { data: diffs } = await db
    .from("holding_diffs")
    .select("stock_id, qty_delta, weight_delta, event")
    .eq("family_id", familyId)
    .eq("month", monthToUse);

  const diffBy = new Map((diffs || []).map((d) => [d.stock_id as string, d]));

  const holdings = (snaps || [])
    .map((s) => {
      const st = asOne(s.stocks);
      const d = diffBy.get(s.stock_id as string);
      return {
        stock_id: s.stock_id,
        display_name: String(st?.display_name ?? "Unknown"),
        sector: (st?.sector as string | null) ?? null,
        quantity: Number(s.quantity),
        market_value_cr: Number(s.market_value_cr),
        weight_pct: Number(s.weight_pct),
        qty_delta: d ? Number(d.qty_delta) : 0,
        weight_delta: d ? Number(d.weight_delta) : 0,
        event: d?.event ?? "hold",
      };
    })
    .sort((a, b) => b.weight_pct - a.weight_pct);

  const sectorMap = new Map<string, { weight: number; value: number }>();
  for (const h of holdings) {
    const key = h.sector || "Unknown";
    const cur = sectorMap.get(key) || { weight: 0, value: 0 };
    cur.weight += h.weight_pct;
    cur.value += h.market_value_cr;
    sectorMap.set(key, cur);
  }
  const sectors = [...sectorMap.entries()]
    .map(([name, v]) => ({ name, weight_pct: v.weight, market_value_cr: v.value }))
    .sort((a, b) => b.weight_pct - a.weight_pct);

  return NextResponse.json({ family, month: monthToUse, holdings, sectors });
}

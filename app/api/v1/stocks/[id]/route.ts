import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";
import { asOne } from "@/lib/rel";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const { id } = await params;
  const month = req.nextUrl.searchParams.get("month");
  const db = createAnonClient();

  const { data: stock, error: sErr } = await db.from("stocks").select("*").eq("id", id).maybeSingle();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!stock) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: history } = await db
    .from("stock_month_aggregates")
    .select("*")
    .eq("stock_id", id)
    .order("month", { ascending: false })
    .limit(6);

  const monthToUse = month || history?.[0]?.month;
  if (!monthToUse) {
    return NextResponse.json({ stock, month: null, history: [], holders: [] });
  }

  const { data: diffs } = await db
    .from("holding_diffs")
    .select("family_id, qty_delta, weight_delta, value_delta_cr, event, families(id, name, amc_slug, sebi_category)")
    .eq("stock_id", id)
    .eq("month", monthToUse);

  const { data: snaps } = await db
    .from("holdings_snapshots")
    .select("family_id, quantity, market_value_cr, weight_pct")
    .eq("stock_id", id)
    .eq("month", monthToUse);

  const snapByFamily = new Map((snaps || []).map((s) => [s.family_id as number, s]));

  const holders = (diffs || [])
    .map((d) => {
      const fam = asOne(d.families);
      const snap = snapByFamily.get(d.family_id as number);
      return {
        family_id: d.family_id,
        family_name: String(fam?.name ?? "Unknown fund"),
        amc_slug: fam?.amc_slug as string | undefined,
        sebi_category: fam?.sebi_category as string | undefined,
        quantity: snap ? Number(snap.quantity) : 0,
        weight_pct: snap ? Number(snap.weight_pct) : 0,
        market_value_cr: snap ? Number(snap.market_value_cr) : 0,
        qty_delta: Number(d.qty_delta),
        weight_delta: Number(d.weight_delta),
        event: d.event,
      };
    })
    .sort((a, b) => Math.abs(b.qty_delta) - Math.abs(a.qty_delta));

  return NextResponse.json({ stock, month: monthToUse, history: history || [], holders });
}

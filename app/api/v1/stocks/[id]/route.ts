import { NextRequest, NextResponse } from "next/server";
import { listCompleteMonths } from "@/lib/holdings-month";
import { createAnonClient, fetchAllRows, supabaseConfigured } from "@/lib/supabase";
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

  const complete = await listCompleteMonths(db);
  let history: { month: string; fund_count: number; fund_count_delta: number }[];
  try {
    history = (
      await Promise.all(
        complete.map(async (m) => {
          const { count, error } = await db
            .from("holdings_snapshots")
            .select("family_id", { count: "exact", head: true })
            .eq("stock_id", id)
            .eq("month", m);
          if (error) throw new Error(error.message);
          return { month: m, fund_count: count ?? 0, fund_count_delta: 0 };
        }),
      )
    ).filter((h) => h.fund_count > 0);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "stock_history_failed" }, { status: 500 });
  }

  const monthToUse = month && complete.includes(month) ? month : history[0]?.month;
  if (!monthToUse) {
    return NextResponse.json({ stock, month: null, history: [], holders: [] });
  }

  type DiffRow = {
    family_id: number;
    qty_delta: number;
    weight_delta: number;
    value_delta_cr: number;
    event: string;
    families: unknown;
  };
  type SnapRow = { family_id: number; quantity: number; market_value_cr: number; weight_pct: number };

  const diffs = await fetchAllRows<DiffRow>(() =>
    db
      .from("holding_diffs")
      .select("family_id, qty_delta, weight_delta, value_delta_cr, event, families(id, name, amc_slug, sebi_category)")
      .eq("stock_id", id)
      .eq("month", monthToUse),
  );
  const snaps = await fetchAllRows<SnapRow>(() =>
    db
      .from("holdings_snapshots")
      .select("family_id, quantity, market_value_cr, weight_pct")
      .eq("stock_id", id)
      .eq("month", monthToUse),
  );

  const snapByFamily = new Map(snaps.map((s) => [s.family_id, s]));
  const diffByFamily = new Map(diffs.map((d) => [d.family_id, d]));
  const familyIds = new Set([...snapByFamily.keys(), ...diffByFamily.keys()]);

  const { data: familyRows } = familyIds.size
    ? await db
        .from("families")
        .select("id, name, amc_slug, sebi_category")
        .in("id", [...familyIds])
    : { data: [] as { id: number; name: string; amc_slug: string; sebi_category: string }[] };
  const familyById = new Map((familyRows || []).map((f) => [f.id as number, f]));

  const holders = [...familyIds]
    .map((familyId) => {
      const snap = snapByFamily.get(familyId);
      const diff = diffByFamily.get(familyId);
      const fam = asOne(diff?.families) || familyById.get(familyId);
      return {
        family_id: familyId,
        family_name: String(fam?.name ?? "Unknown fund"),
        amc_slug: fam?.amc_slug as string | undefined,
        sebi_category: fam?.sebi_category as string | undefined,
        quantity: snap ? Number(snap.quantity) : 0,
        weight_pct: snap ? Number(snap.weight_pct) : 0,
        market_value_cr: snap ? Number(snap.market_value_cr) : 0,
        qty_delta: diff ? Number(diff.qty_delta) : 0,
        weight_delta: diff ? Number(diff.weight_delta) : 0,
        event: diff?.event || "hold",
      };
    })
    .sort((a, b) => b.quantity - a.quantity || Math.abs(b.qty_delta) - Math.abs(a.qty_delta));

  return NextResponse.json({ stock, month: monthToUse, history, holders });
}

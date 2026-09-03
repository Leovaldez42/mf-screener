import { unstable_cache } from "next/cache";
import { listCompleteMonths, listFamilyMonths } from "@/lib/holdings-month";
import { CACHE_TAG_HOLDINGS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import { asOne } from "@/lib/rel";
import { createAnonClient, fetchAllRows } from "@/lib/supabase";
import type { ChaseRow } from "@/lib/types";

type AggRow = {
  stock_id: string;
  fund_count: number;
  fund_count_delta: number;
  net_qty_delta: number;
  net_value_delta_cr: number;
  median_weight_pct: number | null;
  stocks: unknown;
};

async function loadChaseRows(month: string): Promise<ChaseRow[]> {
  const db = createAnonClient();
  const data = await fetchAllRows<AggRow>(() =>
    db
      .from("stock_month_aggregates")
      .select(
        "stock_id, fund_count, fund_count_delta, net_qty_delta, net_value_delta_cr, median_weight_pct, stocks(display_name, sector)",
      )
      .eq("month", month),
  );
  return data.map((r) => {
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
}

export const getChaseRows = unstable_cache(loadChaseRows, ["chase-rows"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadSectorRows(month: string) {
  const db = createAnonClient();
  type DiffRow = { value_delta_cr: number; qty_delta: number; stocks: unknown };
  const data = await fetchAllRows<DiffRow>(() =>
    db.from("holding_diffs").select("value_delta_cr, qty_delta, stocks(sector)").eq("month", month),
  );
  const map = new Map<string, { net_value_delta_cr: number; net_qty_delta: number }>();
  for (const row of data) {
    const st = asOne(row.stocks);
    const key = String(st?.sector || "Unknown");
    const cur = map.get(key) || { net_value_delta_cr: 0, net_qty_delta: 0 };
    cur.net_value_delta_cr += Number(row.value_delta_cr);
    cur.net_qty_delta += Number(row.qty_delta);
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr));
}

export const getSectorRows = unstable_cache(loadSectorRows, ["sector-rows"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

export async function resolveHoldingsMonth(requested: string | null): Promise<string | null> {
  const complete = await listCompleteMonths();
  if (requested && complete.includes(requested)) return requested;
  return complete[0] ?? null;
}

async function loadStockPayload(id: string, requestedMonth: string) {
  const db = createAnonClient();
  const { data: stock, error: sErr } = await db.from("stocks").select("*").eq("id", id).maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!stock) return { error: "not_found" as const };

  const complete = await listCompleteMonths();
  const history = (
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

  const monthToUse =
    requestedMonth && complete.includes(requestedMonth) ? requestedMonth : history[0]?.month;
  if (!monthToUse) {
    return { stock, month: null, history: [], holders: [] };
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

  return { stock, month: monthToUse, history, holders };
}

export const getStockPayload = unstable_cache(loadStockPayload, ["stock-payload"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadFundPayload(familyId: number, requestedMonth: string) {
  const db = createAnonClient();
  const { data: family, error } = await db.from("families").select("*").eq("id", familyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!family) {
    return {
      error: "no_holdings" as const,
      message: "This scheme is not in the Chase holdings universe (top funds by AUM).",
    };
  }

  const complete = await listCompleteMonths();
  const availableMonths = await listFamilyMonths(db, familyId, complete);
  const monthToUse =
    requestedMonth && availableMonths.includes(requestedMonth)
      ? requestedMonth
      : availableMonths[0] || null;
  if (!monthToUse) {
    return { family, month: null, holdings: [], sectors: [], availableMonths, error: null, empty: true };
  }

  const { data: snaps } = await db
    .from("holdings_snapshots")
    .select("stock_id, quantity, market_value_cr, weight_pct, stocks(display_name, sector)")
    .eq("family_id", familyId)
    .eq("month", monthToUse)
    .limit(2000);

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

  return { family, month: monthToUse, holdings, sectors, availableMonths };
}

export const getFundPayload = unstable_cache(loadFundPayload, ["fund-payload"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

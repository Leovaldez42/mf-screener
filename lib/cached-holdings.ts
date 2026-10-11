import { unstable_cache } from "next/cache";
import { computeCanonicalBook, type SnapshotLine } from "@/lib/canonical-holdings";
import { listCompleteMonths, listFamilyMonths, previousMonth } from "@/lib/holdings-month";
import { pickHoldingsMonth } from "@/lib/holdings-month-pick";
import { CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import { asOne } from "@/lib/rel";
import { createAnonClient, fetchAllRows } from "@/lib/supabase";
import {
  instrumentSectorLabel,
  isCashLikeNonEquity,
  isEquityInstrument,
  nonEquityPattern,
  stripDuplicateMarkers,
} from "@/lib/instruments";
import type { ChaseRow } from "@/lib/types";

async function loadMonthSnapshots(month: string): Promise<SnapshotLine[]> {
  const db = createAnonClient();
  const rows = await fetchAllRows<{
    family_id: number;
    stock_id: string;
    quantity: number;
    market_value_cr: number;
    weight_pct: number;
    stocks: unknown;
  }>(() =>
    db
      .from("holdings_snapshots")
      .select("family_id, stock_id, quantity, market_value_cr, weight_pct, stocks(display_name, sector, isin)")
      .eq("month", month),
  );
  const out: SnapshotLine[] = [];
  for (const row of rows) {
    const st = asOne(row.stocks);
    const line: SnapshotLine = {
      family_id: Number(row.family_id),
      stock_id: row.stock_id,
      display_name: String(st?.display_name ?? ""),
      sector: (st?.sector as string | null) ?? null,
      isin: (st?.isin as string | null) ?? null,
      quantity: Number(row.quantity),
      market_value_cr: Number(row.market_value_cr),
      weight_pct: Number(row.weight_pct),
    };
    if (!isEquityInstrument(line)) continue;
    out.push(line);
  }
  return out;
}

async function loadCanonicalBook(month: string) {
  const [current, prior] = await Promise.all([
    loadMonthSnapshots(month),
    loadMonthSnapshots(previousMonth(month)),
  ]);
  return computeCanonicalBook(month, current, prior);
}

/** Full books are ~15MB; Next's data cache rejects items over 2MB. Coalesce in-flight loads only. */
const inflightBooks = new Map<string, ReturnType<typeof loadCanonicalBook>>();

export function getCanonicalBook(month: string) {
  const hit = inflightBooks.get(month);
  if (hit) return hit;
  const pending = loadCanonicalBook(month).finally(() => {
    inflightBooks.delete(month);
  });
  inflightBooks.set(month, pending);
  return pending;
}

async function loadChaseRows(month: string): Promise<ChaseRow[]> {
  return (await getCanonicalBook(month)).chase;
}

export const getChaseRows = unstable_cache(loadChaseRows, ["chase-rows-equity-v7"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadChasePreview(month: string): Promise<{ inflows: ChaseRow[]; outflows: ChaseRow[] }> {
  const rows = await getChaseRows(month);
  const inflows = [...rows]
    .filter((r) => r.net_value_delta_cr > 0)
    .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr)
    .slice(0, 3);
  const outflows = [...rows]
    .filter((r) => r.net_value_delta_cr < 0)
    .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr)
    .slice(0, 3);
  return { inflows, outflows };
}

export const getChasePreview = unstable_cache(loadChasePreview, ["chase-preview", "equity-v7"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadSectorRows(month: string) {
  const book = await getCanonicalBook(month);
  const map = new Map<string, { net_value_delta_cr: number; net_qty_delta: number }>();
  for (const d of book.deltas) {
    const key = instrumentSectorLabel(d) || "Unclassified";
    const cur = map.get(key) || { net_value_delta_cr: 0, net_qty_delta: 0 };
    cur.net_value_delta_cr += d.value_delta_cr;
    cur.net_qty_delta += d.qty_delta;
    map.set(key, cur);
  }
  return {
    excludedNoPriorMonth: book.excludedNoPriorMonth,
    rows: [...map.entries()]
      .map(([sector, v]) => ({ sector, ...v }))
      .sort((a, b) => Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr)),
  };
}

export const getSectorRows = unstable_cache(loadSectorRows, ["sector-rows-equity-v7"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

export type HoldingsCoverage = {
  month: string;
  have: number;
  total: number;
  pct: number;
};

async function loadHoldingsCoverage(month: string): Promise<HoldingsCoverage> {
  const db = createAnonClient();
  const families = await fetchAllRows<{ id: number; amc_slug: string | null }>(() =>
    db.from("families").select("id, amc_slug"),
  );
  const snaps = await fetchAllRows<{ family_id: number }>(() =>
    db.from("holdings_snapshots").select("family_id").eq("month", month),
  );
  const haveFamilies = new Set(snaps.map((s) => s.family_id));
  const amcOf = (slug: string | null) => (slug || "").trim().toLowerCase();
  const totalAmcs = new Set(families.map((f) => amcOf(f.amc_slug)).filter(Boolean));
  const haveAmcs = new Set(
    families.filter((f) => haveFamilies.has(f.id)).map((f) => amcOf(f.amc_slug)).filter(Boolean),
  );
  const total = totalAmcs.size || families.length;
  const have = haveAmcs.size;
  const pct = total > 0 ? Math.round((have / total) * 100) : 100;
  return { month, have, total, pct };
}

export const getHoldingsCoverage = unstable_cache(loadHoldingsCoverage, ["holdings-coverage"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

export async function resolveHoldingsMonth(requested: string | null): Promise<string | null> {
  const complete = await listCompleteMonths();
  if (requested && complete.includes(requested)) return requested;
  return complete[0] ?? null;
}

export async function requireHoldingsMonth(requested: string | null): Promise<
  | { ok: true; month: string; availableMonths: string[] }
  | { ok: false; unknown: boolean; availableMonths: string[] }
> {
  const availableMonths = await listCompleteMonths();
  const picked = pickHoldingsMonth(requested, availableMonths);
  if (picked.unknown) return { ok: false, unknown: true, availableMonths };
  if (!picked.month) return { ok: false, unknown: false, availableMonths };
  return { ok: true, month: picked.month, availableMonths };
}

const STOCK_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isInvalidUuidError(message: string): boolean {
  return /invalid input syntax for type uuid/i.test(message);
}

async function loadStockPayload(id: string, requestedMonth: string) {
  if (!STOCK_UUID.test(id)) return { error: "not_found" as const };
  const db = createAnonClient();
  const { data: stockRow, error: sErr } = await db.from("stocks").select("*").eq("id", id).maybeSingle();
  if (sErr) {
    if (isInvalidUuidError(sErr.message)) return { error: "not_found" as const };
    throw new Error(sErr.message);
  }
  if (!stockRow) return { error: "not_found" as const };
  const stock = {
    ...stockRow,
    display_name: stripDuplicateMarkers(String(stockRow.display_name ?? "")),
    sector: instrumentSectorLabel({
      display_name: String(stockRow.display_name ?? ""),
      sector: (stockRow.sector as string | null) ?? null,
      isin: (stockRow.isin as string | null) ?? null,
    }),
  };

  const complete = await listCompleteMonths();
  const books = await Promise.all(complete.map((m) => getCanonicalBook(m)));
  const history = books
    .map((book, i) => {
      const canonicalId = book.aliasToCanonical[id] || id;
      const row = book.chase.find((r) => r.stock_id === canonicalId);
      return {
        month: complete[i],
        fund_count: row?.fund_count ?? 0,
        fund_count_delta: row?.fund_count_delta ?? 0,
      };
    })
    .filter((h) => h.fund_count > 0);

  const monthToUse =
    requestedMonth && complete.includes(requestedMonth) ? requestedMonth : history[0]?.month;
  if (!monthToUse) {
    return { stock, month: null, history: [], holders: [], summary: null };
  }

  const book = books[complete.indexOf(monthToUse)] || (await getCanonicalBook(monthToUse));
  const canonicalId = book.aliasToCanonical[id] || id;
  const meta = book.stocks[canonicalId];
  if (meta) {
    stock.display_name = meta.display_name;
    stock.sector = instrumentSectorLabel(meta);
  }
  const chaseRow = book.chase.find((r) => r.stock_id === canonicalId);
  const stockDeltas = book.deltas.filter((d) => d.stock_id === canonicalId);
  const familyIds = [...new Set(stockDeltas.map((d) => d.family_id))];
  const { data: familyRows } = familyIds.length
    ? await db.from("families").select("id, name, amc_slug, sebi_category").in("id", familyIds)
    : { data: [] as { id: number; name: string; amc_slug: string; sebi_category: string }[] };
  const familyById = new Map((familyRows || []).map((f) => [f.id as number, f]));

  const holders = stockDeltas
    .filter((d) => d.qty > 0 || d.event === "exit" || d.qty_delta !== 0)
    .map((d) => {
      const fam = familyById.get(d.family_id);
      return {
        family_id: d.family_id,
        family_name: String(fam?.name ?? "Unknown fund"),
        amc_slug: fam?.amc_slug as string | undefined,
        sebi_category: fam?.sebi_category as string | undefined,
        quantity: d.qty,
        weight_pct: d.weight_pct,
        market_value_cr: d.value_cr,
        qty_delta: d.qty_delta,
        weight_delta: d.weight_delta,
        event: d.event,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || Math.abs(b.qty_delta) - Math.abs(a.qty_delta));

  const summary = chaseRow
    ? {
        fund_count: chaseRow.fund_count,
        fund_count_delta: chaseRow.fund_count_delta,
        net_qty_delta: chaseRow.net_qty_delta,
        net_value_delta_cr: chaseRow.net_value_delta_cr,
      }
    : {
        fund_count: holders.filter((h) => h.quantity > 0).length,
        fund_count_delta: 0,
        net_qty_delta: 0,
        net_value_delta_cr: 0,
      };

  return { stock, month: monthToUse, history, holders, summary };
}

export const getStockPayload = unstable_cache(loadStockPayload, ["stock-payload-v7"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadFundPayload(familyId: number, requestedMonth: string) {
  const db = createAnonClient();
  const { data: family, error } = await db.from("families").select("*").eq("id", familyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!family) {
    return { error: "not_found" as const };
  }

  const complete = await listCompleteMonths();
  const availableMonths = await listFamilyMonths(db, familyId, complete);
  if (requestedMonth) {
    if (!availableMonths.includes(requestedMonth)) {
      return { error: "unknown_month" as const, availableMonths };
    }
  }
  const monthToUse = requestedMonth || availableMonths[0] || null;
  if (!monthToUse) {
    const { data: metric } = await db
      .from("scheme_metrics")
      .select("aum_cr")
      .eq("scheme_code", String(familyId))
      .maybeSingle();
    return {
      family,
      aum_cr: metric?.aum_cr == null ? null : Number(metric.aum_cr),
      month: null,
      holdings: [],
      sectors: [],
      availableMonths,
      error: null,
      empty: true,
    };
  }

  const [{ data: metric }, book] = await Promise.all([
    db.from("scheme_metrics").select("aum_cr").eq("scheme_code", String(familyId)).maybeSingle(),
    getCanonicalBook(monthToUse),
  ]);
  const aum_cr = metric?.aum_cr == null ? null : Number(metric.aum_cr);
  const holdings = book.deltas
    .filter((d) => d.family_id === familyId && d.qty > 0)
    .map((d) => ({
      stock_id: d.stock_id,
      display_name: stripDuplicateMarkers(d.display_name || "Unknown"),
      sector: d.sector,
      isin: d.isin,
      quantity: d.qty,
      market_value_cr: d.value_cr,
      weight_pct: d.weight_pct,
      qty_delta: d.qty_delta,
      weight_delta: d.weight_delta,
      event: d.event,
    }))
    .sort((a, b) => b.weight_pct - a.weight_pct);

  const sectorMap = new Map<string, { weight: number; value: number }>();
  for (const h of holdings) {
    const p = nonEquityPattern(h);
    if (p && isCashLikeNonEquity(h)) continue;
    const key = p ? "Other instruments" : instrumentSectorLabel(h);
    const cur = sectorMap.get(key) || { weight: 0, value: 0 };
    cur.weight += h.weight_pct;
    cur.value += h.market_value_cr;
    sectorMap.set(key, cur);
  }
  const sectors = [...sectorMap.entries()]
    .map(([name, v]) => ({ name, weight_pct: v.weight, market_value_cr: v.value }))
    .sort((a, b) => b.weight_pct - a.weight_pct);

  return { family, aum_cr, month: monthToUse, holdings, sectors, availableMonths };
}

export const getFundPayload = unstable_cache(loadFundPayload, ["fund-payload-equity-v7"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS],
});

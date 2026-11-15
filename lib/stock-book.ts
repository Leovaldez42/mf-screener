import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCanonicalBook, type CanonicalBook, type SnapshotLine } from "@/lib/canonical-holdings";
import { previousMonth } from "@/lib/holdings-month";
import { effectiveIsin, isEquityInstrument, normalizeInstrumentName } from "@/lib/instruments";
import { asOne } from "@/lib/rel";

type StockKeyRow = { id: string; isin: string | null; name_key: string | null; display_name: string | null };

const STOCK_KEY_COLS = "id, isin, name_key, display_name";

/**
 * Stock ids that the canonical book could merge with `id`: same ISIN, or same `normalizeInstrumentName`
 * (which folds Corporation/Corp, Company/Co, & /and that `name_key` keeps apart).
 */
export async function loadAliasCandidates(db: SupabaseClient, id: string): Promise<string[]> {
  const { data: self, error } = await db.from("stocks").select(STOCK_KEY_COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!self) return [];
  const ids = new Set<string>();
  const isins = new Set<string>();
  const names = new Set<string>();
  const firstTokens = new Set<string>();
  const add = (r: StockKeyRow) => {
    ids.add(r.id);
    const isin = effectiveIsin(r.isin);
    if (isin) isins.add(isin);
    const n = normalizeInstrumentName(r.display_name || "");
    if (n) names.add(n);
    const token = (r.name_key || "").split(" ")[0];
    if (token) firstTokens.add(token);
  };
  add(self as StockKeyRow);
  for (let pass = 0; pass < 3; pass++) {
    const before = ids.size;
    const queries = [
      ...(isins.size ? [db.from("stocks").select(STOCK_KEY_COLS).in("isin", [...isins]).limit(500)] : []),
      ...[...firstTokens].map((t) => db.from("stocks").select(STOCK_KEY_COLS).like("name_key", `${t}%`).limit(2000)),
    ];
    for (const res of await Promise.all(queries)) {
      if (res.error) throw new Error(res.error.message);
      for (const r of (res.data || []) as StockKeyRow[]) {
        const isin = effectiveIsin(r.isin);
        if ((isin && isins.has(isin)) || names.has(normalizeInstrumentName(r.display_name || ""))) add(r);
      }
    }
    if (ids.size === before) break;
  }
  return [...ids];
}

/** Every fund with a disclosed book in `month`. One row per fund, not per holding. */
export async function queryMonthFamilyIds(db: SupabaseClient, month: string, attempt = 0): Promise<number[]> {
  const { data, error } = await db
    .from("families")
    .select("id, holdings_snapshots!inner(month)")
    .eq("holdings_snapshots.month", month)
    .limit(1, { referencedTable: "holdings_snapshots" })
    .limit(10000);
  if (error) {
    if (attempt < 4 && /statement timeout|canceling statement/i.test(error.message)) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return queryMonthFamilyIds(db, month, attempt + 1);
    }
    throw new Error(error.message);
  }
  return (data || []).map((r) => Number(r.id));
}

async function loadStockLines(db: SupabaseClient, stockIds: string[], months: string[]) {
  const byMonth = new Map<string, SnapshotLine[]>();
  for (const m of months) byMonth.set(m, []);
  const page = 1000;
  for (let from = 0; from < 100000; from += page) {
    const { data, error } = await db
      .from("holdings_snapshots")
      .select("month, family_id, stock_id, quantity, market_value_cr, weight_pct, stocks(display_name, sector, isin)")
      .in("stock_id", stockIds)
      .in("month", months)
      .order("month")
      .order("family_id")
      .order("stock_id")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const st = asOne(row.stocks as unknown);
      const line: SnapshotLine = {
        family_id: Number(row.family_id),
        stock_id: row.stock_id as string,
        display_name: String(st?.display_name ?? ""),
        sector: (st?.sector as string | null) ?? null,
        isin: (st?.isin as string | null) ?? null,
        quantity: Number(row.quantity),
        market_value_cr: Number(row.market_value_cr),
        weight_pct: Number(row.weight_pct),
      };
      if (isEquityInstrument(line)) byMonth.get(row.month as string)?.push(line);
    }
    if (!data || data.length < page) break;
  }
  return byMonth;
}

/**
 * Canonical books restricted to one stock and its aliases, one per month. Same MoM rules as the full
 * book, at a few hundred rows per month instead of every holding of every fund.
 */
export async function loadStockBooks(
  db: SupabaseClient,
  id: string,
  months: string[],
  familyIdsFor: (month: string) => Promise<number[]>,
): Promise<Map<string, CanonicalBook>> {
  const out = new Map<string, CanonicalBook>();
  if (!months.length) return out;
  const aliases = await loadAliasCandidates(db, id);
  if (!aliases.length) return out;
  const allMonths = [...new Set(months.flatMap((m) => [m, previousMonth(m)]))];
  const [lines, families] = await Promise.all([
    loadStockLines(db, aliases, allMonths),
    Promise.all(allMonths.map(async (m) => [m, await familyIdsFor(m)] as const)),
  ]);
  const famByMonth = new Map(families);
  for (const m of months) {
    const prev = previousMonth(m);
    out.set(
      m,
      computeCanonicalBook(m, lines.get(m) || [], lines.get(prev) || [], {
        current: famByMonth.get(m) || [],
        prior: famByMonth.get(prev) || [],
      }),
    );
  }
  return out;
}

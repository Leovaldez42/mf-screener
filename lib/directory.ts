import { unstable_cache } from "next/cache";
import { listCompleteMonths } from "@/lib/holdings-month";
import { CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import {
  groupDuplicateRows,
  instrumentSectorLabel,
  isEquityInstrument,
  pickCleanestDisplayName,
  stripDuplicateMarkers,
} from "@/lib/instruments";
import { asOne } from "@/lib/rel";
import { createAnonClient, fetchAllRows } from "@/lib/supabase";

export type FundDirectoryRow = {
  id: number;
  name: string;
  house: string;
  amc_slug: string;
  category: string;
  aum_cr: number | null;
};

export type StockDirectoryRow = {
  id: string;
  name: string;
  sector: string;
  fund_count: number;
  isin: string | null;
};

async function metricsByCodes(codes: string[]) {
  const db = createAnonClient();
  const metrics: { scheme_code: string; aum_cr: number | null; category: string | null }[] = [];
  for (let i = 0; i < codes.length; i += 200) {
    const chunk = codes.slice(i, i + 200);
    const { data, error } = await db
      .from("scheme_metrics")
      .select("scheme_code, aum_cr, category")
      .in("scheme_code", chunk);
    if (error) throw new Error(error.message);
    metrics.push(...((data || []) as typeof metrics));
  }
  return new Map(metrics.map((m) => [String(m.scheme_code), m]));
}

async function loadFundDirectory(): Promise<FundDirectoryRow[]> {
  const db = createAnonClient();
  const families = await fetchAllRows<{
    id: number;
    name: string;
    amc_slug: string | null;
    sebi_category: string | null;
  }>(() =>
    db
      .from("families")
      .select("id, name, amc_slug, sebi_category")
      .eq("is_active_equity", true)
      .eq("has_holdings", true),
  );
  const amcs = await fetchAllRows<{ slug: string; name: string }>(() =>
    db.from("amcs").select("slug, name"),
  );
  const houseBySlug = new Map(amcs.map((a) => [a.slug, a.name]));
  const metricBy = await metricsByCodes(families.map((f) => String(f.id)));
  return families
    .map((f) => {
      const metric = metricBy.get(String(f.id));
      const slug = (f.amc_slug || "").trim();
      return {
        id: Number(f.id),
        name: String(f.name),
        house: houseBySlug.get(slug) || slug || "Other",
        amc_slug: slug,
        category: String(metric?.category || f.sebi_category || "").trim() || "Uncategorised",
        aum_cr: metric?.aum_cr == null ? null : Number(metric.aum_cr),
      };
    })
    .sort(
      (a, b) =>
        a.house.localeCompare(b.house, "en-IN") ||
        (b.aum_cr ?? 0) - (a.aum_cr ?? 0) ||
        a.name.localeCompare(b.name, "en-IN"),
    );
}

async function loadStockDirectory(): Promise<{ month: string | null; stocks: StockDirectoryRow[] }> {
  const months = await listCompleteMonths();
  const month = months[0] ?? null;
  if (!month) return { month: null, stocks: [] };
  const db = createAnonClient();
  const rows = await fetchAllRows<{ stock_id: string; family_id: number; stocks: unknown }>(() =>
    db
      .from("holdings_snapshots")
      .select("stock_id, family_id, stocks(display_name, sector, isin)")
      .eq("month", month),
  );
  const byId = new Map<
    string,
    { stock_id: string; display_name: string; sector: string | null; isin: string | null; funds: Set<number> }
  >();
  for (const row of rows) {
    const st = asOne(row.stocks);
    const display_name = String(st?.display_name ?? "");
    const sector = (st?.sector as string | null) ?? null;
    const isin = (st?.isin as string | null) ?? null;
    if (!isEquityInstrument({ display_name, sector, isin })) continue;
    const cur = byId.get(row.stock_id) || {
      stock_id: row.stock_id,
      display_name: stripDuplicateMarkers(display_name),
      sector,
      isin,
      funds: new Set<number>(),
    };
    cur.funds.add(Number(row.family_id));
    byId.set(row.stock_id, cur);
  }
  const grouped = groupDuplicateRows(
    [...byId.values()].map((r) => ({
      ...r,
      fund_count: r.funds.size,
    })),
  );
  const stocks = grouped
    .map((group) => {
      const canonical = [...group].sort((a, b) => b.fund_count - a.fund_count)[0];
      const funds = new Set<number>();
      for (const g of group) for (const id of g.funds) funds.add(id);
      return {
        id: canonical.stock_id,
        name: pickCleanestDisplayName(group.map((g) => g.display_name)),
        sector: instrumentSectorLabel(canonical) || "Unclassified",
        fund_count: funds.size,
        isin: canonical.isin,
      };
    })
    .filter((s) => s.fund_count > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "en-IN") || b.fund_count - a.fund_count);
  return { month, stocks };
}

export const getFundDirectory = unstable_cache(loadFundDirectory, ["fund-directory-v1"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS],
});

export const getStockDirectory = unstable_cache(loadStockDirectory, ["stock-directory-v3"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

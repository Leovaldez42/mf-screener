import type { CanonicalBook } from "@/lib/canonical-holdings";
import type { FundDirectoryRow } from "@/lib/directory";
import { fundPortfolioSector, instrumentSectorLabel, stripDuplicateMarkers } from "@/lib/instruments";
import { buildMonthlyReport, type MonthlyReport } from "@/lib/monthly-report";
import { reportListHeadline } from "@/lib/report-copy";
import type { SearchIndex } from "@/lib/search";
import type { ReportSnapshotPayload, SiteMetaSnapshot } from "@/lib/snapshot-read";
import type { ChaseRow } from "@/lib/types";

export const TOP_STATIC_IDS = 200;

export function reportArtifactsFromBook(
  book: CanonicalBook,
  extras: {
    families: { id: number; name: string; amc_slug: string }[];
    amcNames: Record<string, string>;
    amcAum: Record<string, number>;
    coverage: { month: string; have: number; total: number; pct: number };
  },
): ReportSnapshotPayload {
  const report = buildMonthlyReport({
    month: book.month,
    diffs: book.deltas.map((d) => ({
      family_id: d.family_id,
      stock_id: d.stock_id,
      display_name: d.display_name,
      sector: d.sector,
      isin: d.isin,
      qty_delta: d.qty_delta,
      value_delta_cr: d.value_delta_cr,
      event: d.event,
      qty: d.qty,
      prevQty: d.prevQty,
    })),
    currentFamilyIds: book.currentFamilyIds,
    priorFamilyIds: book.priorFamilyIds,
    priorHoldings: book.deltas
      .filter((d) => d.prevQty > 0)
      .map((d) => ({
        family_id: d.family_id,
        stock_id: d.stock_id,
        display_name: d.display_name,
        sector: d.sector,
        isin: d.isin,
      })),
    families: extras.families,
    amcNames: extras.amcNames,
    amcAum: extras.amcAum,
    fundHousesTotal: extras.coverage.total,
  });

  const sectorMap = new Map<string, { net_value_delta_cr: number; net_qty_delta: number }>();
  for (const d of book.deltas) {
    const key = instrumentSectorLabel(d) || "Unclassified";
    const cur = sectorMap.get(key) || { net_value_delta_cr: 0, net_qty_delta: 0 };
    cur.net_value_delta_cr += d.value_delta_cr;
    cur.net_qty_delta += d.qty_delta;
    sectorMap.set(key, cur);
  }
  const sectors = [...sectorMap.entries()]
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr));

  return {
    report,
    chase: book.chase,
    sectors,
    excludedNoPriorMonth: book.excludedNoPriorMonth,
    coverage: extras.coverage,
  };
}

export function fundPayloadFromBook(
  book: CanonicalBook,
  family: {
    id: number;
    name: string;
    amc_slug: string | null;
    sebi_category: string | null;
    is_active_equity?: boolean;
    has_holdings?: boolean;
    latest_month?: string | null;
  },
  aum_cr: number | null,
  availableMonths: string[],
) {
  const familyId = Number(family.id);
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
      net_value_delta_cr: d.value_delta_cr,
      mv_change_cr: d.mv_change_cr,
      weight_delta: d.weight_delta,
      event: d.event,
    }))
    .sort((a, b) => b.weight_pct - a.weight_pct);

  const sectorMap = new Map<string, { weight: number; value: number }>();
  for (const h of holdings) {
    const key = fundPortfolioSector(h);
    const cur = sectorMap.get(key) || { weight: 0, value: 0 };
    cur.weight += h.weight_pct;
    cur.value += h.market_value_cr;
    sectorMap.set(key, cur);
  }
  let listed = 0;
  for (const v of sectorMap.values()) listed += v.weight;
  const gap = 100 - listed;
  if (gap >= 0.05) {
    const cur = sectorMap.get("Cash & others") || { weight: 0, value: 0 };
    cur.weight += gap;
    sectorMap.set("Cash & others", cur);
  }
  const sectors = [...sectorMap.entries()]
    .map(([name, v]) => ({ name, weight_pct: v.weight, market_value_cr: v.value }))
    .sort((a, b) => b.weight_pct - a.weight_pct);

  return {
    family,
    aum_cr,
    month: book.month,
    holdings,
    sectors,
    availableMonths,
  };
}

export function stockPayloadFromBook(
  book: CanonicalBook,
  id: string,
  stock: { id: string; display_name: string; sector: string | null; isin: string | null },
  familyById: Map<number, { id: number; name: string; amc_slug: string | null; sebi_category: string | null }>,
  history: { month: string; fund_count: number; fund_count_delta: number }[],
) {
  const canonicalId = book.aliasToCanonical[id] || id;
  const meta = book.stocks[canonicalId];
  const display_name = meta?.display_name || stripDuplicateMarkers(String(stock.display_name ?? ""));
  const sector = instrumentSectorLabel(meta || stock);
  const chaseRow = book.chase.find((r) => r.stock_id === canonicalId);
  const stockDeltas = book.deltas.filter((d) => d.stock_id === canonicalId);
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
        net_value_delta_cr: d.value_delta_cr,
        mv_change_cr: d.mv_change_cr,
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
        mv_change_cr: chaseRow.mv_change_cr ?? 0,
      }
    : {
        fund_count: holders.filter((h) => h.quantity > 0).length,
        fund_count_delta: 0,
        net_qty_delta: 0,
        net_value_delta_cr: 0,
        mv_change_cr: 0,
      };

  return {
    stock: { ...stock, display_name, sector },
    month: book.month,
    history: history.filter((h) => h.fund_count > 0),
    holders,
    summary,
  };
}

export function topIds(funds: FundDirectoryRow[], chase: ChaseRow[]) {
  const topFundIds = [...funds]
    .sort((a, b) => (b.aum_cr ?? 0) - (a.aum_cr ?? 0) || a.name.localeCompare(b.name, "en-IN"))
    .slice(0, TOP_STATIC_IDS)
    .map((f) => f.id);
  const topStockIds = [...chase]
    .sort((a, b) => b.fund_count - a.fund_count || Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr))
    .slice(0, TOP_STATIC_IDS)
    .map((r) => r.stock_id);
  return { topFundIds, topStockIds };
}

export function headlinesFromReports(reports: { month: string; report: MonthlyReport }[]) {
  return reports.map((r) => ({ month: r.month, headline: reportListHeadline(r.report) }));
}

export function siteMetaPayload(opts: {
  months: string[];
  freshness: SiteMetaSnapshot["freshness"];
  topFundIds: number[];
  topStockIds: string[];
  fundDirectory: SiteMetaSnapshot["fundDirectory"];
  stockDirectory: SiteMetaSnapshot["stockDirectory"];
  reportHeadlines: SiteMetaSnapshot["reportHeadlines"];
  overlapSuggestions: SiteMetaSnapshot["overlapSuggestions"];
  searchIndex: SearchIndex;
}): SiteMetaSnapshot {
  return opts;
}

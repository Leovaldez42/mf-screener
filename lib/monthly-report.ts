import { pickHoldingsMonth } from "@/lib/holdings-month-pick";
import { isJunkSector, sectorLabel } from "@/lib/format";
import { classifyHoldingEvent } from "@/lib/canonical-holdings";
import {
  collapseChaseGroup,
  groupDuplicateRows,
  instrumentSectorLabel,
  isEquityInstrument,
  type MergeableChase,
} from "@/lib/instruments";

export const CONVICTION_MIN_FUNDS = 10;
export const CONVICTION_MIN_HOUSES = 5;
export const CONVICTION_MIN_GROWTH = 0.2;
export const CONVICTION_LIST_CAP = 15;
export const FRESH_ENTRY_MIN_FUNDS = 2;
export const FULL_EXIT_MIN_FUNDS = 2;

export type ReportDiffRow = {
  family_id: number;
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin: string | null;
  qty_delta: number;
  value_delta_cr: number;
  event: string;
  qty?: number;
  prevQty?: number;
};

export type ReportHoldingRow = {
  family_id: number;
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin: string | null;
};

export type ReportFamily = {
  id: number;
  name: string;
  amc_slug: string;
};

export type ReportFundExample = {
  family_id: number;
  family_name: string;
};

export type ReportStockRow = {
  stock_id: string;
  display_name: string;
  sector: string;
  funds: number;
  fund_houses: number;
  net_value_delta_cr: number;
  examples: ReportFundExample[];
};

export type ReportSectorRow = {
  sector: string;
  net_value_delta_cr: number;
};

export type ReportAmcBet = {
  amc_slug: string;
  amc_name: string;
  buy: { stock_id: string; display_name: string; net_value_delta_cr: number } | null;
  sell: { stock_id: string; display_name: string; net_value_delta_cr: number } | null;
};

export type MonthlyReportSummary = {
  fundsCovered: number;
  fundHousesCovered: number;
  fundHousesTotal: number;
  fundHousesCoveragePct: number;
  totalNetEquityBuyingCr: number;
  excludedNoPriorMonth: number;
};

export type MonthlyReport = {
  month: string;
  summary: MonthlyReportSummary;
  mostBought: ReportStockRow[];
  mostSold: ReportStockRow[];
  topNetBuys: ReportStockRow[];
  topNetSells: ReportStockRow[];
  convictionBuys: ReportStockRow[];
  convictionOmitted: number;
  freshEntries: ReportStockRow[];
  fullExits: ReportStockRow[];
  sectorRotation: { gained: ReportSectorRow[]; lost: ReportSectorRow[] };
  amcBigBets: ReportAmcBet[];
};

export type MonthlyReportInput = {
  month: string;
  diffs: ReportDiffRow[];
  currentFamilyIds: number[];
  priorFamilyIds: number[];
  priorHoldings: ReportHoldingRow[];
  families: ReportFamily[];
  amcNames: Record<string, string>;
  fundHousesTotal: number;
  convictionMinFunds?: number;
  convictionMinHouses?: number;
  convictionMinGrowth?: number;
};

type Canonical = { id: string; display_name: string; sector: string };

function stub(row: { stock_id: string; display_name: string; sector: string | null; isin: string | null }): MergeableChase {
  return {
    stock_id: row.stock_id,
    display_name: row.display_name,
    sector: row.sector,
    isin: row.isin,
    fund_count: 1,
    fund_count_delta: 0,
    net_qty_delta: 0,
    net_value_delta_cr: 0,
    median_weight_pct: null,
  };
}

export function buildCanonicalMap(
  rows: { stock_id: string; display_name: string; sector: string | null; isin: string | null }[],
): Map<string, Canonical> {
  const seen = new Map<string, MergeableChase>();
  for (const row of rows) {
    if (!isEquityInstrument(row)) continue;
    if (seen.has(row.stock_id)) continue;
    seen.set(row.stock_id, stub(row));
  }
  const map = new Map<string, Canonical>();
  for (const group of groupDuplicateRows([...seen.values()])) {
    const collapsed = collapseChaseGroup(group);
    const canonical: Canonical = {
      id: collapsed.stock_id,
      display_name: collapsed.display_name,
      sector: instrumentSectorLabel(collapsed) || sectorLabel(collapsed.sector),
    };
    for (const r of group) map.set(r.stock_id, canonical);
  }
  return map;
}

function titleAmc(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

function examplesFrom(
  familyValues: Map<number, number>,
  familyById: Map<number, ReportFamily>,
  limit = 3,
): ReportFundExample[] {
  return [...familyValues.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([id]) => ({
      family_id: id,
      family_name: familyById.get(id)?.name || String(id),
    }));
}

function stockRow(
  stock: Canonical,
  funds: Map<number, number>,
  houses: Set<string>,
  net: number,
  familyById: Map<number, ReportFamily>,
): ReportStockRow {
  return {
    stock_id: stock.id,
    display_name: stock.display_name,
    sector: stock.sector,
    funds: funds.size,
    fund_houses: houses.size,
    net_value_delta_cr: net,
    examples: examplesFrom(funds, familyById),
  };
}

export function reportMonthLookup(
  requested: string | null | undefined,
  availableMonths: string[],
):
  | { status: 200; month: string }
  | { status: 404; body: { error: string; availableMonths: string[] } }
  | { status: 200; month: null } {
  const picked = pickHoldingsMonth(requested, availableMonths);
  if (picked.unknown) {
    return { status: 404, body: { error: "unknown_month", availableMonths } };
  }
  if (!picked.month) return { status: 200, month: null };
  return { status: 200, month: picked.month };
}

export function comparableFamilyIds(currentFamilyIds: number[], priorFamilyIds: number[]): {
  included: Set<number>;
  excludedNoPriorMonth: number;
} {
  const prior = new Set(priorFamilyIds);
  const included = new Set<number>();
  let excludedNoPriorMonth = 0;
  for (const id of new Set(currentFamilyIds)) {
    if (prior.has(id)) included.add(id);
    else excludedNoPriorMonth += 1;
  }
  return { included, excludedNoPriorMonth };
}

export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  const convictionMinFunds = input.convictionMinFunds ?? CONVICTION_MIN_FUNDS;
  const convictionMinHouses = input.convictionMinHouses ?? CONVICTION_MIN_HOUSES;
  const convictionMinGrowth = input.convictionMinGrowth ?? CONVICTION_MIN_GROWTH;
  const familyById = new Map(input.families.map((f) => [f.id, f]));
  const { included, excludedNoPriorMonth } = comparableFamilyIds(
    input.currentFamilyIds,
    input.priorFamilyIds,
  );

  const coveredFamilies = [...new Set(input.currentFamilyIds)];
  const coveredHouses = new Set(
    coveredFamilies.map((id) => (familyById.get(id)?.amc_slug || "").trim().toLowerCase()).filter(Boolean),
  );
  const fundHousesTotal = input.fundHousesTotal > 0 ? input.fundHousesTotal : coveredHouses.size;
  const fundHousesCovered = coveredHouses.size;
  const fundHousesCoveragePct =
    fundHousesTotal > 0 ? Math.round((fundHousesCovered / fundHousesTotal) * 100) : 100;

  const equityDiffs = input.diffs.filter((d) => isEquityInstrument(d) && included.has(d.family_id));
  const equityPrior = input.priorHoldings.filter((h) => isEquityInstrument(h));

  const canon = buildCanonicalMap([...equityDiffs, ...equityPrior]);

  const priorHeld = new Set<string>();
  for (const h of equityPrior) {
    const c = canon.get(h.stock_id);
    if (c) priorHeld.add(c.id);
  }

  type Pair = {
    family_id: number;
    stock: Canonical;
    qtyDelta: number;
    value: number;
    qty: number;
    prevQty: number;
    hasLevels: boolean;
  };
  const pairs = new Map<string, Pair>();
  for (const d of equityDiffs) {
    const stock = canon.get(d.stock_id);
    if (!stock) continue;
    const key = `${d.family_id}:${stock.id}`;
    const cur = pairs.get(key) || {
      family_id: d.family_id,
      stock,
      qtyDelta: 0,
      value: 0,
      qty: 0,
      prevQty: 0,
      hasLevels: false,
    };
    cur.qtyDelta += d.qty_delta;
    cur.value += d.value_delta_cr;
    if (typeof d.qty === "number" && typeof d.prevQty === "number") {
      cur.qty += d.qty;
      cur.prevQty += d.prevQty;
      cur.hasLevels = true;
    }
    pairs.set(key, cur);
  }

  type Agg = {
    stock: Canonical;
    net: number;
    adding: Map<number, number>;
    cutting: Map<number, number>;
    exiting: Map<number, number>;
    addingHouses: Set<string>;
    cuttingHouses: Set<string>;
    holdersThis: Set<number>;
    holdersPrior: Set<number>;
  };
  const byStock = new Map<string, Agg>();
  const amcStock = new Map<string, Map<string, { stock: Canonical; net: number }>>();

  let totalNetEquityBuyingCr = 0;

  for (const pair of pairs.values()) {
    const event = pair.hasLevels
      ? classifyHoldingEvent(pair.prevQty, pair.qty)
      : pair.qtyDelta > 0
        ? "add"
        : pair.qtyDelta < 0
          ? "cut"
          : "hold";
    if (pair.qtyDelta === 0 && event !== "exit") {
      const aggHold = byStock.get(pair.stock.id) || {
        stock: pair.stock,
        net: 0,
        adding: new Map(),
        cutting: new Map(),
        exiting: new Map(),
        addingHouses: new Set<string>(),
        cuttingHouses: new Set<string>(),
        holdersThis: new Set<number>(),
        holdersPrior: new Set<number>(),
      };
      if (pair.hasLevels) {
        if (pair.qty > 0) aggHold.holdersThis.add(pair.family_id);
        if (pair.prevQty > 0) aggHold.holdersPrior.add(pair.family_id);
      }
      byStock.set(pair.stock.id, aggHold);
      continue;
    }
    totalNetEquityBuyingCr += pair.value;
    const agg = byStock.get(pair.stock.id) || {
      stock: pair.stock,
      net: 0,
      adding: new Map(),
      cutting: new Map(),
      exiting: new Map(),
      addingHouses: new Set<string>(),
      cuttingHouses: new Set<string>(),
      holdersThis: new Set<number>(),
      holdersPrior: new Set<number>(),
    };
    agg.net += pair.value;
    const slug = (familyById.get(pair.family_id)?.amc_slug || "").trim().toLowerCase();
    if (pair.qtyDelta > 0) {
      agg.adding.set(pair.family_id, (agg.adding.get(pair.family_id) || 0) + pair.value);
      if (slug) agg.addingHouses.add(slug);
    } else if (pair.qtyDelta < 0) {
      agg.cutting.set(pair.family_id, (agg.cutting.get(pair.family_id) || 0) + pair.value);
      if (slug) agg.cuttingHouses.add(slug);
    }
    if (event === "exit") {
      agg.exiting.set(pair.family_id, (agg.exiting.get(pair.family_id) || 0) + pair.value);
    }
    if (pair.hasLevels) {
      if (pair.qty > 0) agg.holdersThis.add(pair.family_id);
      if (pair.prevQty > 0) agg.holdersPrior.add(pair.family_id);
    }
    byStock.set(pair.stock.id, agg);

    if (slug) {
      const stocks = amcStock.get(slug) || new Map();
      const cur = stocks.get(pair.stock.id) || { stock: pair.stock, net: 0 };
      cur.net += pair.value;
      stocks.set(pair.stock.id, cur);
      amcStock.set(slug, stocks);
    }
  }

  const allStocks = [...byStock.values()];

  const mostBought = allStocks
    .filter((s) => s.adding.size > 0)
    .sort(
      (a, b) =>
        b.adding.size - a.adding.size ||
        b.net - a.net ||
        a.stock.display_name.localeCompare(b.stock.display_name),
    )
    .slice(0, 10)
    .map((s) => stockRow(s.stock, s.adding, s.addingHouses, s.net, familyById));

  const mostSold = allStocks
    .filter((s) => s.cutting.size > 0)
    .sort(
      (a, b) =>
        b.cutting.size - a.cutting.size ||
        a.net - b.net ||
        a.stock.display_name.localeCompare(b.stock.display_name),
    )
    .slice(0, 10)
    .map((s) => stockRow(s.stock, s.cutting, s.cuttingHouses, s.net, familyById));

  const topNetBuys = allStocks
    .filter((s) => s.net > 0)
    .sort((a, b) => b.net - a.net || a.stock.display_name.localeCompare(b.stock.display_name))
    .slice(0, 10)
    .map((s) => stockRow(s.stock, s.adding, s.addingHouses, s.net, familyById));

  const topNetSells = allStocks
    .filter((s) => s.net < 0)
    .sort((a, b) => a.net - b.net || a.stock.display_name.localeCompare(b.stock.display_name))
    .slice(0, 10)
    .map((s) => stockRow(s.stock, s.cutting, s.cuttingHouses, s.net, familyById));

  const convictionAll = allStocks
    .filter((s) => {
      if (s.adding.size < convictionMinFunds || s.addingHouses.size < convictionMinHouses) return false;
      const prior = s.holdersPrior.size;
      const now = s.holdersThis.size;
      if (now === 0 && prior === 0) return true;
      if (prior === 0) return true;
      return (now - prior) / prior >= convictionMinGrowth;
    })
    .sort(
      (a, b) =>
        b.adding.size - a.adding.size ||
        b.net - a.net ||
        a.stock.display_name.localeCompare(b.stock.display_name),
    );
  const convictionBuys = convictionAll
    .slice(0, CONVICTION_LIST_CAP)
    .map((s) => stockRow(s.stock, s.adding, s.addingHouses, s.net, familyById));
  const convictionOmitted = Math.max(0, convictionAll.length - convictionBuys.length);

  const freshEntries = allStocks
    .filter((s) => !priorHeld.has(s.stock.id) && s.adding.size >= FRESH_ENTRY_MIN_FUNDS)
    .sort(
      (a, b) =>
        b.adding.size - a.adding.size ||
        b.net - a.net ||
        a.stock.display_name.localeCompare(b.stock.display_name),
    )
    .map((s) => stockRow(s.stock, s.adding, s.addingHouses, s.net, familyById));

  const fullExits = allStocks
    .filter((s) => s.exiting.size >= FULL_EXIT_MIN_FUNDS)
    .sort(
      (a, b) =>
        b.exiting.size - a.exiting.size ||
        a.net - b.net ||
        a.stock.display_name.localeCompare(b.stock.display_name),
    )
    .map((s) => stockRow(s.stock, s.exiting, s.cuttingHouses, s.net, familyById));

  const sectorNet = new Map<string, number>();
  for (const s of allStocks) {
    const label = isJunkSector(s.stock.sector) ? "Unclassified" : sectorLabel(s.stock.sector);
    sectorNet.set(label, (sectorNet.get(label) || 0) + s.net);
  }
  const sectorRows = [...sectorNet.entries()].map(([sector, net_value_delta_cr]) => ({
    sector,
    net_value_delta_cr,
  }));
  const gained = sectorRows
    .filter((r) => r.net_value_delta_cr > 0)
    .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr)
    .slice(0, 5);
  const lost = sectorRows
    .filter((r) => r.net_value_delta_cr < 0)
    .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr)
    .slice(0, 5);

  const amcBigBets: ReportAmcBet[] = [];
  for (const [slug, stocks] of amcStock) {
    const values = [...stocks.values()];
    const buy = values
      .filter((v) => v.net > 0)
      .sort((a, b) => b.net - a.net)[0];
    const sell = values
      .filter((v) => v.net < 0)
      .sort((a, b) => a.net - b.net)[0];
    if (!buy && !sell) continue;
    amcBigBets.push({
      amc_slug: slug,
      amc_name: input.amcNames[slug] || titleAmc(slug),
      buy: buy
        ? { stock_id: buy.stock.id, display_name: buy.stock.display_name, net_value_delta_cr: buy.net }
        : null,
      sell: sell
        ? { stock_id: sell.stock.id, display_name: sell.stock.display_name, net_value_delta_cr: sell.net }
        : null,
    });
  }
  amcBigBets.sort((a, b) => {
    const av = Math.max(Math.abs(a.buy?.net_value_delta_cr || 0), Math.abs(a.sell?.net_value_delta_cr || 0));
    const bv = Math.max(Math.abs(b.buy?.net_value_delta_cr || 0), Math.abs(b.sell?.net_value_delta_cr || 0));
    return bv - av || a.amc_name.localeCompare(b.amc_name);
  });

  return {
    month: input.month,
    summary: {
      fundsCovered: coveredFamilies.length,
      fundHousesCovered,
      fundHousesTotal,
      fundHousesCoveragePct,
      totalNetEquityBuyingCr,
      excludedNoPriorMonth,
    },
    mostBought,
    mostSold,
    topNetBuys,
    topNetSells,
    convictionBuys,
    convictionOmitted,
    freshEntries,
    fullExits,
    sectorRotation: { gained, lost },
    amcBigBets,
  };
}

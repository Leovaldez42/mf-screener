import {
  groupDuplicateRows,
  instrumentSectorLabel,
  isEquityInstrument,
  pickCleanestDisplayName,
  type MergeableChase,
} from "@/lib/instruments";
import { holdingFlowCr } from "@/lib/holding-flow";
import { comparableFamilyIds } from "@/lib/mom-universe";
import type { ChaseRow, HoldingEvent } from "@/lib/types";

export type SnapshotLine = {
  family_id: number;
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin: string | null;
  quantity: number;
  market_value_cr: number;
  weight_pct: number;
};

export type CanonicalStockMeta = {
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin: string | null;
  aliases: string[];
};

export type CanonicalFundDelta = {
  family_id: number;
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin: string | null;
  qty: number;
  prevQty: number;
  qty_delta: number;
  value_cr: number;
  prevValueCr: number;
  value_delta_cr: number;
  mv_change_cr: number;
  weight_pct: number;
  prevWeightPct: number;
  weight_delta: number;
  event: HoldingEvent;
};

export type CanonicalBook = {
  month: string;
  chase: ChaseRow[];
  priorCount: Record<string, number>;
  aliasToCanonical: Record<string, string>;
  stocks: Record<string, CanonicalStockMeta>;
  deltas: CanonicalFundDelta[];
  currentFamilyIds: number[];
  priorFamilyIds: number[];
  excludedNoPriorMonth: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function classifyHoldingEvent(prevQty: number, qty: number): HoldingEvent {
  if (prevQty <= 0 && qty > 0) return "new";
  if (prevQty > 0 && qty <= 0) return "exit";
  if (qty > prevQty) return "add";
  if (qty < prevQty) return "cut";
  return "hold";
}

export function buildCanonicalIdentity(
  rows: { stock_id: string; display_name: string; sector: string | null; isin: string | null }[],
  currentCountById: Record<string, number> = {},
): { aliasToCanonical: Record<string, string>; stocks: Record<string, CanonicalStockMeta> } {
  const seen = new Map<string, MergeableChase>();
  for (const row of rows) {
    if (!row.stock_id || seen.has(row.stock_id)) continue;
    if (!isEquityInstrument(row)) continue;
    seen.set(row.stock_id, {
      stock_id: row.stock_id,
      display_name: row.display_name,
      sector: row.sector,
      isin: row.isin,
      fund_count: currentCountById[row.stock_id] || 1,
      fund_count_delta: 0,
      net_qty_delta: 0,
      net_value_delta_cr: 0,
      median_weight_pct: null,
    });
  }
  const aliasToCanonical: Record<string, string> = {};
  const stocks: Record<string, CanonicalStockMeta> = {};
  for (const group of groupDuplicateRows([...seen.values()])) {
    const canonical = [...group].sort((a, b) => {
      const byCount = (currentCountById[b.stock_id] || 0) - (currentCountById[a.stock_id] || 0);
      if (byCount) return byCount;
      const clean = pickCleanestDisplayName([a.display_name, b.display_name]);
      return clean === a.display_name ? -1 : clean === b.display_name ? 1 : 0;
    })[0];
    const isin = group.map((g) => g.isin).find((v) => v) || canonical.isin || null;
    const meta: CanonicalStockMeta = {
      stock_id: canonical.stock_id,
      display_name: pickCleanestDisplayName(group.map((g) => g.display_name)),
      sector: instrumentSectorLabel(canonical),
      isin,
      aliases: group.map((g) => g.stock_id),
    };
    stocks[meta.stock_id] = meta;
    for (const r of group) aliasToCanonical[r.stock_id] = meta.stock_id;
  }
  return { aliasToCanonical, stocks };
}

type Collapsed = {
  family_id: number;
  stock_id: string;
  qty: number;
  value: number;
  weight: number;
};

function collapseByCanonical(
  lines: SnapshotLine[],
  aliasToCanonical: Record<string, string>,
): Map<string, Collapsed> {
  const out = new Map<string, Collapsed>();
  for (const line of lines) {
    if (!isEquityInstrument(line)) continue;
    const stock_id = aliasToCanonical[line.stock_id];
    if (!stock_id) continue;
    const key = `${line.family_id}:${stock_id}`;
    const cur = out.get(key) || { family_id: line.family_id, stock_id, qty: 0, value: 0, weight: 0 };
    cur.qty += line.quantity;
    cur.value += line.market_value_cr;
    cur.weight += line.weight_pct;
    out.set(key, cur);
  }
  return out;
}

export function computeCanonicalBook(
  month: string,
  current: SnapshotLine[],
  prior: SnapshotLine[],
): CanonicalBook {
  const currentCountById: Record<string, number> = {};
  for (const line of current) currentCountById[line.stock_id] = (currentCountById[line.stock_id] || 0) + 1;
  const { aliasToCanonical, stocks } = buildCanonicalIdentity([...current, ...prior], currentCountById);
  const curMap = collapseByCanonical(current, aliasToCanonical);
  const prevMap = collapseByCanonical(prior, aliasToCanonical);

  const currentFamilyIds = [...new Set(current.map((r) => r.family_id))];
  const priorFamilyIds = [...new Set(prior.map((r) => r.family_id))];
  const { included, excludedNoPriorMonth } = comparableFamilyIds(currentFamilyIds, priorFamilyIds);

  const keys = new Set([...curMap.keys(), ...prevMap.keys()]);
  const deltas: CanonicalFundDelta[] = [];
  const holdersThis = new Map<string, Set<number>>();
  const holdersPrior = new Map<string, Set<number>>();
  const weightsThis = new Map<string, number[]>();
  const netQty = new Map<string, number>();
  const netVal = new Map<string, number>();
  const netMv = new Map<string, number>();

  for (const key of keys) {
    const cur = curMap.get(key);
    const prev = prevMap.get(key);
    const family_id = cur?.family_id ?? prev!.family_id;
    const stock_id = cur?.stock_id ?? prev!.stock_id;
    const qty = cur?.qty ?? 0;
    const prevQty = prev?.qty ?? 0;
    const value_cr = cur?.value ?? 0;
    const prevValueCr = prev?.value ?? 0;
    const weight_pct = cur?.weight ?? 0;
    const prevWeightPct = prev?.weight ?? 0;
    const comparable = included.has(family_id);
    const event = comparable ? classifyHoldingEvent(prevQty, qty) : "hold";
    const qty_delta = comparable ? qty - prevQty : 0;
    const mv_change_cr = comparable ? value_cr - prevValueCr : 0;
    const value_delta_cr = comparable
      ? holdingFlowCr({
          quantity: qty,
          market_value_cr: value_cr,
          prev_quantity: prevQty,
          prev_market_value_cr: prevValueCr,
          qty_delta,
        })
      : 0;
    const momMove = comparable && event !== "hold";
    const weight_delta = comparable ? weight_pct - prevWeightPct : 0;
    const meta = stocks[stock_id];
    deltas.push({
      family_id,
      stock_id,
      display_name: meta?.display_name || "",
      sector: meta?.sector ?? null,
      isin: meta?.isin ?? null,
      qty,
      prevQty,
      qty_delta,
      value_cr,
      prevValueCr,
      value_delta_cr,
      mv_change_cr,
      weight_pct,
      prevWeightPct,
      weight_delta,
      event,
    });
    if (qty > 0) {
      const set = holdersThis.get(stock_id) || new Set();
      set.add(family_id);
      holdersThis.set(stock_id, set);
      const w = weightsThis.get(stock_id) || [];
      w.push(weight_pct);
      weightsThis.set(stock_id, w);
    }
    if (prevQty > 0) {
      const set = holdersPrior.get(stock_id) || new Set();
      set.add(family_id);
      holdersPrior.set(stock_id, set);
    }
    if (comparable) {
      netMv.set(stock_id, (netMv.get(stock_id) || 0) + mv_change_cr);
    }
    if (momMove) {
      netQty.set(stock_id, (netQty.get(stock_id) || 0) + qty_delta);
      netVal.set(stock_id, (netVal.get(stock_id) || 0) + value_delta_cr);
    }
  }

  const priorCount: Record<string, number> = {};
  const chase: ChaseRow[] = Object.values(stocks).map((meta) => {
    const holders = holdersThis.get(meta.stock_id) || new Set();
    const priorHolders = holdersPrior.get(meta.stock_id) || new Set();
    const fund_count = holders.size;
    const prior_count = priorHolders.size;
    priorCount[meta.stock_id] = prior_count;
    let comparableThis = 0;
    let comparablePrior = 0;
    for (const id of holders) if (included.has(id)) comparableThis += 1;
    for (const id of priorHolders) if (included.has(id)) comparablePrior += 1;
    return {
      stock_id: meta.stock_id,
      display_name: meta.display_name,
      sector: meta.sector,
      fund_count,
      fund_count_delta: comparableThis - comparablePrior,
      net_qty_delta: netQty.get(meta.stock_id) || 0,
      net_value_delta_cr: netVal.get(meta.stock_id) || 0,
      mv_change_cr: netMv.get(meta.stock_id) || 0,
      median_weight_pct: median(weightsThis.get(meta.stock_id) || []),
    };
  });

  assertMomInvariants(chase, priorCount, deltas, included, holdersThis, holdersPrior);

  return {
    month,
    chase: chase.filter((r) => r.fund_count > 0 || r.fund_count_delta !== 0 || r.net_qty_delta !== 0),
    priorCount,
    aliasToCanonical,
    stocks,
    deltas,
    currentFamilyIds,
    priorFamilyIds,
    excludedNoPriorMonth,
  };
}

export function assertMomInvariants(
  chase: ChaseRow[],
  priorCount: Record<string, number>,
  deltas: CanonicalFundDelta[],
  included?: Set<number>,
  holdersThis?: Map<string, Set<number>>,
  holdersPrior?: Map<string, Set<number>>,
) {
  const errors: string[] = [];
  for (const row of chase) {
    let expected: number;
    if (included && holdersThis && holdersPrior) {
      const cur = holdersThis.get(row.stock_id) || new Set();
      const prev = holdersPrior.get(row.stock_id) || new Set();
      let comparableThis = 0;
      let comparablePrior = 0;
      for (const id of cur) if (included.has(id)) comparableThis += 1;
      for (const id of prev) if (included.has(id)) comparablePrior += 1;
      expected = comparableThis - comparablePrior;
    } else {
      expected = row.fund_count - (priorCount[row.stock_id] ?? 0);
    }
    if (row.fund_count_delta !== expected) {
      errors.push(
        `${row.display_name}: fund_count_delta ${row.fund_count_delta} != ${expected}`,
      );
    }
  }
  const pairEvent = new Map<string, HoldingEvent>();
  for (const d of deltas) {
    const key = `${d.family_id}:${d.stock_id}`;
    const prev = pairEvent.get(key);
    if (prev && prev !== d.event) {
      errors.push(`fund ${d.family_id} has ${prev} and ${d.event} on ${d.display_name}`);
    }
    pairEvent.set(key, d.event);
    if (d.event === "new" && d.prevQty > 0) {
      errors.push(`fund ${d.family_id} new ${d.display_name} with prior qty`);
    }
    if (d.event === "exit" && d.qty > 0) {
      errors.push(`fund ${d.family_id} exit ${d.display_name} with remaining qty`);
    }
  }
  if (!errors.length) return;
  const message = `MoM invariant failed: ${errors.slice(0, 8).join("; ")}`;
  if (process.env.NODE_ENV !== "production") throw new Error(message);
  console.error(message);
}

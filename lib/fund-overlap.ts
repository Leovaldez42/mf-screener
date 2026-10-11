import {
  collapseChaseGroup,
  groupDuplicateRows,
  instrumentSectorLabel,
  isEquityInstrument,
  type MergeableChase,
} from "@/lib/instruments";

export const OVERLAP_MIN_FUNDS = 2;
export const OVERLAP_MAX_FUNDS = 3;

export type OverlapLine = {
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin?: string | null;
  weight_pct: number;
};

export type AlignedBook = {
  code: string;
  holdings: OverlapLine[];
  byId: Map<string, OverlapLine>;
};

export type SectorPairRow = {
  name: string;
  weights: Record<string, number>;
  min: number;
};

export type PairOverlap = {
  a: string;
  b: string;
  overlap_pct: number;
  common_count: number;
  sector_overlap_pct: number;
  common: CommonHolding[];
  sectors: SectorPairRow[];
};

export type CommonHolding = {
  stock_id: string;
  name: string;
  sector: string;
  weights: Record<string, number>;
  min_weight: number;
};

export function commonMonths(lists: string[][]): string[] {
  if (!lists.length) return [];
  const sets = lists.map((l) => new Set(l));
  return [...new Set(lists[0].filter((m) => sets.every((s) => s.has(m))))].sort((a, b) =>
    b.localeCompare(a),
  );
}

export function pickOverlapMonth(
  requested: string | null | undefined,
  lists: string[][],
): { month: string | null; commonMonths: string[]; unknown: boolean } {
  const common = commonMonths(lists);
  const req = (requested || "").trim();
  if (!req) return { month: common[0] ?? null, commonMonths: common, unknown: false };
  if (common.includes(req)) return { month: req, commonMonths: common, unknown: false };
  return { month: null, commonMonths: common, unknown: true };
}

function asMergeable(row: OverlapLine): MergeableChase {
  return {
    stock_id: row.stock_id,
    display_name: row.display_name,
    sector: row.sector,
    isin: row.isin ?? null,
    fund_count: 1,
    fund_count_delta: 0,
    net_qty_delta: 0,
    net_value_delta_cr: row.weight_pct,
    median_weight_pct: row.weight_pct,
  };
}

/** Same grouping as /api/v1/chase; weights of aliases are summed. */
export function mergeEquityHoldings(rows: OverlapLine[]): OverlapLine[] {
  const equity = rows.filter((r) => isEquityInstrument(r));
  const groups = groupDuplicateRows(equity.map(asMergeable));
  return groups.map((group) => {
    const collapsed = collapseChaseGroup(group);
    const weight = group.reduce((s, g) => s + (g.median_weight_pct || 0), 0);
    return {
      stock_id: collapsed.stock_id,
      display_name: collapsed.display_name,
      sector: collapsed.sector,
      isin: collapsed.isin,
      weight_pct: weight,
    };
  });
}

/** Map every original stock_id onto the chase canonical row. */
export function canonicalStockMap(rows: OverlapLine[]): Map<string, OverlapLine> {
  const unique = new Map<string, OverlapLine>();
  for (const row of rows) {
    if (!unique.has(row.stock_id)) unique.set(row.stock_id, row);
  }
  const groups = groupDuplicateRows([...unique.values()].map(asMergeable));
  const map = new Map<string, OverlapLine>();
  for (const group of groups) {
    const collapsed = collapseChaseGroup(group);
    const canon: OverlapLine = {
      stock_id: collapsed.stock_id,
      display_name: collapsed.display_name,
      sector: collapsed.sector,
      isin: collapsed.isin,
      weight_pct: 0,
    };
    for (const g of group) map.set(g.stock_id, canon);
  }
  return map;
}

export function alignBooks(books: { code: string; holdings: OverlapLine[] }[]): AlignedBook[] {
  const merged = books.map((b) => ({
    code: b.code,
    holdings: mergeEquityHoldings(b.holdings),
  }));
  const canon = canonicalStockMap(merged.flatMap((b) => b.holdings));
  return merged.map((b) => {
    const byId = new Map<string, OverlapLine>();
    for (const h of b.holdings) {
      const c = canon.get(h.stock_id) || h;
      const cur = byId.get(c.stock_id);
      if (cur) cur.weight_pct += h.weight_pct;
      else {
        byId.set(c.stock_id, {
          stock_id: c.stock_id,
          display_name: c.display_name,
          sector: c.sector,
          isin: c.isin,
          weight_pct: h.weight_pct,
        });
      }
    }
    return {
      code: b.code,
      holdings: [...byId.values()].sort((a, b) => b.weight_pct - a.weight_pct),
      byId,
    };
  });
}

export function pairOverlap(a: AlignedBook, b: AlignedBook): PairOverlap {
  const common: CommonHolding[] = [];
  let overlap = 0;
  for (const [id, ha] of a.byId) {
    const hb = b.byId.get(id);
    if (!hb) continue;
    const min_weight = Math.min(ha.weight_pct, hb.weight_pct);
    overlap += min_weight;
    common.push({
      stock_id: id,
      name: ha.display_name,
      sector: instrumentSectorLabel(ha),
      weights: { [a.code]: ha.weight_pct, [b.code]: hb.weight_pct },
      min_weight,
    });
  }
  common.sort((x, y) => y.min_weight - x.min_weight);
  const sa = sectorWeights(a);
  const sb = sectorWeights(b);
  const names = new Set([...sa.keys(), ...sb.keys()]);
  const sectors: SectorPairRow[] = [...names]
    .map((name) => {
      const wa = sa.get(name) || 0;
      const wb = sb.get(name) || 0;
      return { name, weights: { [a.code]: wa, [b.code]: wb }, min: Math.min(wa, wb) };
    })
    .filter((r) => r.min > 0)
    .sort((x, y) => y.min - x.min);
  return {
    a: a.code,
    b: b.code,
    overlap_pct: overlap,
    common_count: common.length,
    sector_overlap_pct: sectors.reduce((s, r) => s + r.min, 0),
    common,
    sectors,
  };
}

export function sectorWeights(book: AlignedBook): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of book.holdings) {
    const key = instrumentSectorLabel(h);
    map.set(key, (map.get(key) || 0) + h.weight_pct);
  }
  return map;
}

export function sectorOverlap(a: AlignedBook, b: AlignedBook): number {
  const sa = sectorWeights(a);
  const sb = sectorWeights(b);
  let sum = 0;
  for (const [sector, wa] of sa) {
    const wb = sb.get(sector);
    if (wb == null) continue;
    sum += Math.min(wa, wb);
  }
  return sum;
}

export function holdingsInAll(books: AlignedBook[]): CommonHolding[] {
  if (books.length < 2) return [];
  const [first, ...rest] = books;
  const out: CommonHolding[] = [];
  for (const [id, h0] of first.byId) {
    const others = rest.map((b) => b.byId.get(id));
    if (others.some((h) => !h)) continue;
    const weights: Record<string, number> = { [first.code]: h0.weight_pct };
    let min_weight = h0.weight_pct;
    rest.forEach((b, i) => {
      const w = others[i]!.weight_pct;
      weights[b.code] = w;
      min_weight = Math.min(min_weight, w);
    });
    out.push({
      stock_id: id,
      name: h0.display_name,
      sector: instrumentSectorLabel(h0),
      weights,
      min_weight,
    });
  }
  out.sort((a, b) => b.min_weight - a.min_weight);
  return out;
}

export function uniqueHoldings(books: AlignedBook[], code: string, limit = 10): OverlapLine[] {
  const mine = books.find((b) => b.code === code);
  if (!mine) return [];
  const others = books.filter((b) => b.code !== code);
  return mine.holdings
    .filter((h) => others.every((o) => !o.byId.has(h.stock_id)))
    .slice(0, limit);
}

export function overlapVerdict(pct: number): { level: "low" | "moderate" | "high"; text: string } {
  if (pct < 20) {
    return {
      level: "low",
      text: "Low overlap — these funds hold mostly different stocks",
    };
  }
  if (pct <= 50) {
    return { level: "moderate", text: "Moderate overlap" };
  }
  return {
    level: "high",
    text: "High overlap — owning both adds little diversification",
  };
}

export function allPairs(books: AlignedBook[]): PairOverlap[] {
  const pairs: PairOverlap[] = [];
  for (let i = 0; i < books.length; i++) {
    for (let j = i + 1; j < books.length; j++) {
      pairs.push(pairOverlap(books[i], books[j]));
    }
  }
  return pairs;
}

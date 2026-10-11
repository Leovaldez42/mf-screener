export type InstrumentRow = {
  display_name?: string | null;
  name?: string | null;
  sector?: string | null;
  isin?: string | null;
};

/** Exact sector labels that are never listed as equity (case-insensitive). */
export const NON_EQUITY_SECTORS = new Set([
  "index futures",
  "stock future",
  "index",
  "overseas mutual fund",
  "not applicable",
]);

const CASH_REPO =
  /\b(?:treps|cblo|tri[-\s]?party(?:\s+repo)?|reverse\s+repo)\b/i;

const CASH_EQUIV =
  /\bnet\s+current\s+assets?\b|\bnet\s+receivables?\b|\bcash\s*(?:&|and)\s*cash\s+equivalents?\b|\bcash\s+equivalents?\b/i;

const OVERSEAS_MF = /\boverseas\s+mutual\s+fund(?:\s+units?)?\b/i;

const ETF_INDEX = /\betf\b|\bbees\b|\bindex fund\b/i;

const MF_UNIT =
  /\bliquid\s+fund\b|\bglobal funds\b|\bmaster fund\b|\bucits\b|\bliquid\s+direct\b/i;

const MF_FUND = /\bfunds?\b/i;
const MF_SHARE_TOKEN = /(?:^|[^a-z0-9])(direct|regular|growth|plan)(?=[^a-z0-9]|$)/gi;

const REIT_INVIT =
  /\breit\b|\binvit\b|\binvestment trust\b|\breal estate trust\b|\binfra(?:structure)?\s+trust\b|\bhighways trust\b|\bbusiness parks\b|\bknowledge realty trust\b/i;

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Index / stock F&O names seen in FinAPI books (August 2026 sample). */
const DERIVATIVE = new RegExp(
  [
    String.raw`\b(?:fut|ce|pe)\s*$`,
    String.raw`\bfutures?\s*$`,
    String.raw`\b(?:call|put)\b`,
    String.raw`\b${MONTH}\s*[-/]?\s*\d{2,4}\s*$`,
    String.raw`\b${MONTH}\d{2}\s*$`,
    String.raw`[_-\s.]?\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*$`,
    String.raw`^(?:bank\s+)?nifty(?:\s+index)?(?:\s|$)`,
    String.raw`^nse\s+nifty\b`,
    String.raw`^cnx\s+(?:bank\s+)?(?:nifty|index)\b`,
    String.raw`^midcapnifty\b`,
    String.raw`^sensex\b`,
  ].join("|"),
  "i",
);

const MARKER_END = /(?:\$\$|\^\^|[$#@^*]+|[-–—]\s*qip)\s*$/i;

export type NonEquityPattern =
  | "sector"
  | "cash_repo"
  | "cash_equiv"
  | "overseas_mf"
  | "etf_index"
  | "mf_unit"
  | "reit_invit"
  | "derivative";

function fields(row: InstrumentRow): { name: string; sector: string; hay: string } {
  const name = (row.display_name ?? row.name ?? "").trim();
  const sector = (row.sector ?? "").trim();
  return { name, sector, hay: `${name} ${sector}`.trim() };
}

function mfShareTokens(name: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(MF_SHARE_TOKEN.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(name))) out.add(m[1].toLowerCase());
  return out;
}

function isMfUnitName(name: string): boolean {
  const trimmed = name.trim();
  if (/\bfund\s*$/i.test(trimmed)) return true;
  if (/fund\s*,\s*class/i.test(trimmed)) return true;
  if (/\bequity fund\b/i.test(trimmed)) return true;
  if (MF_UNIT.test(name)) return true;
  const tokens = mfShareTokens(name);
  if (tokens.size >= 2) return true;
  return MF_FUND.test(name) && tokens.size >= 1;
}

/** Why this row is excluded from equity rollups, or null if it is equity. */
export function nonEquityPattern(row: InstrumentRow): NonEquityPattern | null {
  const { name, sector, hay } = fields(row);
  if (sector && NON_EQUITY_SECTORS.has(sector.toLowerCase())) return "sector";
  if (CASH_REPO.test(hay)) return "cash_repo";
  if (CASH_EQUIV.test(hay)) return "cash_equiv";
  if (OVERSEAS_MF.test(hay)) return "overseas_mf";
  if (ETF_INDEX.test(name)) return "etf_index";
  if (REIT_INVIT.test(name)) return "reit_invit";
  if (isMfUnitName(name)) return "mf_unit";
  if (DERIVATIVE.test(name)) return "derivative";
  return null;
}

/** True for listed equity; false for cash, repo, F&O, funds, REITs, and listed junk sectors. */
export function isEquityInstrument(row: InstrumentRow): boolean {
  return nonEquityPattern(row) === null;
}

export function isCashLikeNonEquity(row: InstrumentRow): boolean {
  const p = nonEquityPattern(row);
  return p === "cash_repo" || p === "cash_equiv";
}

export function pickCleanestDisplayName(names: string[]): string {
  if (!names.length) return "";
  let best = names[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const name of names) {
    const score = scoreDisplayName(name);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return stripDuplicateMarkers(best).replace(/^\s*eq\s*-+\s*/i, "").trim();
}

function scoreDisplayName(name: string): number {
  const t = (name || "").trim();
  let s = 0;
  if (/^eq\s*-/i.test(t)) s -= 50;
  if (/\$\$|#|@|\^\^/.test(t)) s -= 30;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) s -= 40;
  if (/\blimited\b/i.test(t)) s += 8;
  s += Math.min(stripDuplicateMarkers(t).replace(/^\s*eq\s*-+\s*/i, "").length, 40);
  return s;
}

/** Strip $$ / ^^ / ** / -QIP style duplicate markers from a display name. */
export function stripDuplicateMarkers(name: string): string {
  let s = (name || "").trim();
  s = s.replace(/\s*(?:\$\$|\^\^)+\s*$/g, "");
  s = s.replace(/\s*[#@^]+\s*$/g, "");
  s = s.replace(/\s*\*+\s*$/g, "");
  s = s.replace(/\s*[-–—]\s*qip\s*$/i, "");
  return s.replace(/\s+/g, " ").trim();
}

export function isMarkedDuplicateName(name: string): boolean {
  return MARKER_END.test((name || "").trim());
}

/** Case-folded name used to join duplicate stock IDs. */
export function normalizeInstrumentName(name: string): string {
  let s = (name || "").toLowerCase();
  s = s.replace(/^\s*eq\s*-+\s*/, "");
  s = s.replace(/\s*(?:\$\$|\^\^)+\s*$/g, "");
  s = s.replace(/\s*[#@^]+\s*$/g, "");
  s = s.replace(/\s*\*+\s*$/g, "");
  s = s.replace(/\s*[-–—]?\s*qip\s*$/g, "");
  s = s.replace(/\blimited\b/g, "ltd");
  s = s.replace(/\bcompany\b/g, "co");
  s = s.replace(/\bcorporation\b/g, "corp");
  s = s.replace(/&/g, "and");
  return s.replace(/[^a-z0-9]/g, "");
}

/** 12-character ISINs only. Ticker/date codes like PAYTM300326 are treated as missing. */
export function effectiveIsin(isin: string | null | undefined): string | null {
  const s = (isin || "").trim().toUpperCase();
  if (!s) return null;
  if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(s)) return null;
  return s;
}

const UNLISTED_INDIAN =
  /\(india\)|\bpvt\.?\b|\bprivate limited\b|\.com ltd\b|[#@]\s*$/i;

const DUMMY_INDIAN_ISIN = /^(IDIA|EQ)[0-9A-Z]/i;

function isUnlistedIndianHolding(row: InstrumentRow): boolean {
  const name = (row.display_name ?? row.name ?? "").trim();
  if (name && UNLISTED_INDIAN.test(name)) return true;
  const isin = (row.isin || "").trim();
  return DUMMY_INDIAN_ISIN.test(isin);
}

export function instrumentSectorLabel(row: InstrumentRow): string {
  const sector = (row.sector || "").trim();
  if (sector) return sector;
  if (isUnlistedIndianHolding(row)) return "Unlisted / other";
  const rawIsin = (row.isin || "").trim().toUpperCase();
  if (!rawIsin || rawIsin.startsWith("IN")) return "Unclassified";
  const name = (row.display_name ?? row.name ?? "").trim();
  if (/\bltd\.?\s*$/i.test(name) || /\blimited\s*$/i.test(name)) return "Unclassified";
  const isin = effectiveIsin(row.isin);
  if (isin && !isin.startsWith("IN")) return "Overseas equity";
  return "Unclassified";
}

export type MergeableChase = {
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin?: string | null;
  fund_count: number;
  fund_count_delta: number;
  net_qty_delta: number;
  net_value_delta_cr: number;
  median_weight_pct: number | null;
  fund_ids?: number[];
};

export function groupDuplicateRows<T extends { display_name: string; isin?: string | null; fund_count?: number }>(
  rows: T[],
): T[][] {
  const byIsin = new Map<string, T[]>();
  const byName = new Map<string, T[]>();
  for (const r of rows) {
    const isin = effectiveIsin(r.isin);
    if (isin) {
      const arr = byIsin.get(isin) || [];
      arr.push(r);
      byIsin.set(isin, arr);
    } else {
      const k = normalizeInstrumentName(r.display_name);
      const arr = byName.get(k) || [];
      arr.push(r);
      byName.set(k, arr);
    }
  }
  const isinsForName = new Map<string, string[]>();
  for (const [isin, group] of byIsin) {
    for (const r of group) {
      const n = normalizeInstrumentName(r.display_name);
      const arr = isinsForName.get(n) || [];
      if (!arr.includes(isin)) arr.push(isin);
      isinsForName.set(n, arr);
    }
  }
  for (const [name, group] of [...byName]) {
    const isins = isinsForName.get(name);
    if (!isins?.length) continue;
    let best = isins[0];
    let bestCount = -1;
    for (const isin of isins) {
      const n = (byIsin.get(isin) || []).reduce((s, r) => s + (r.fund_count || 0), 0);
      if (n >= bestCount) {
        bestCount = n;
        best = isin;
      }
    }
    byIsin.get(best)!.push(...group);
    byName.delete(name);
  }
  const buckets = [...byIsin.values(), ...byName.values()];
  const parent = buckets.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number) {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  }
  const nameToBucket = new Map<string, number>();
  buckets.forEach((group, i) => {
    for (const r of group) {
      const n = normalizeInstrumentName(r.display_name);
      if (!n) continue;
      const prev = nameToBucket.get(n);
      if (prev == null) nameToBucket.set(n, i);
      else union(prev, i);
    }
  });
  const merged = new Map<number, T[]>();
  buckets.forEach((group, i) => {
    const p = find(i);
    const arr = merged.get(p) || [];
    arr.push(...group);
    merged.set(p, arr);
  });
  return [...merged.values()];
}

export function collapseChaseGroup(
  group: MergeableChase[],
  fundIdsByStock?: Map<string, Iterable<number>>,
): MergeableChase {
  const canonical = [...group].sort(
    (a, b) => b.fund_count - a.fund_count || Math.abs(b.net_value_delta_cr) - Math.abs(a.net_value_delta_cr),
  )[0];
  const funds = new Set<number>();
  let hasIds = false;
  if (fundIdsByStock) {
    for (const r of group) {
      const ids = fundIdsByStock.get(r.stock_id);
      if (!ids) continue;
      hasIds = true;
      for (const id of ids) funds.add(id);
    }
  } else {
    for (const r of group) {
      if (!r.fund_ids?.length) continue;
      hasIds = true;
      for (const id of r.fund_ids) funds.add(id);
    }
  }
  return {
    ...canonical,
    stock_id: canonical.stock_id,
    display_name: pickCleanestDisplayName(group.map((g) => g.display_name)),
    sector: instrumentSectorLabel(canonical),
    fund_count: hasIds ? funds.size : canonical.fund_count,
    fund_count_delta: group.reduce((s, g) => s + g.fund_count_delta, 0),
    net_qty_delta: group.reduce((s, g) => s + g.net_qty_delta, 0),
    net_value_delta_cr: group.reduce((s, g) => s + g.net_value_delta_cr, 0),
    median_weight_pct: canonical.median_weight_pct,
  };
}

/** Fold aliases into the main stock (real ISIN, else normalized name). */
export function mergeChaseDuplicates(
  rows: MergeableChase[],
  fundIdsByStock?: Map<string, Iterable<number>>,
): { rows: MergeableChase[]; mergedCount: number; groups: MergeableChase[][] } {
  const groups = groupDuplicateRows(rows);
  let mergedCount = 0;
  const out: MergeableChase[] = [];
  for (const group of groups) {
    mergedCount += Math.max(0, group.length - 1);
    out.push(collapseChaseGroup(group, fundIdsByStock));
  }
  return { rows: out, mergedCount, groups };
}

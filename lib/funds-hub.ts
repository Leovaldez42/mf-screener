export const FUNDS_TABS = ["screener", "compare", "overlap", "all"] as const;
export type FundsTab = (typeof FUNDS_TABS)[number];

export const SCREENER_PARAM_KEYS = [
  "class",
  "q",
  "house",
  "style",
  "sort",
  "order",
  "showAll",
  "page",
  "minSharpe",
  "maxExpense",
  "maxPe",
  "minCagr1y",
  "minCagr3y",
  "minCagrInception",
  "minAum",
  "maxAum",
] as const;

const COMPARE_OVERLAP_KEYS = ["funds", "codes", "month"] as const;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function parseFundsTab(raw: string | string[] | undefined): FundsTab {
  const value = firstParam(raw).toLowerCase();
  if (value === "screener" || value === "compare" || value === "overlap" || value === "all") return value;
  return "screener";
}

export function parseCsvIds(raw: string | null | undefined, max: number): string[] {
  return [...new Set((raw || "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, max);
}

export function fundsHubPath(tab: FundsTab, params?: URLSearchParams | Record<string, string | undefined | null>): string {
  const p = new URLSearchParams();
  if (tab !== "screener") p.set("tab", tab);
  const src =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(
          Object.entries(params || {})
            .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
            .map(([k, v]) => [k, v]),
        );
  for (const [key, value] of src.entries()) {
    if (key === "tab" || !value) continue;
    p.set(key, value);
  }
  const qs = p.toString();
  return qs ? `/funds?${qs}` : "/funds";
}

export function pickTabParams(tab: FundsTab, search: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams();
  const keys =
    tab === "screener"
      ? SCREENER_PARAM_KEYS
      : tab === "all"
        ? (["q"] as const)
        : COMPARE_OVERLAP_KEYS;
  for (const key of keys) {
    if (key === "codes" && tab !== "compare") continue;
    const value = search.get(key);
    if (!value) continue;
    if (key === "codes" && !search.get("funds")) p.set("funds", value);
    else if (key !== "codes") p.set(key, value);
  }
  return p;
}

export function fundsHubTitle(tab: FundsTab, overlapNames?: string[]): string {
  if (tab === "compare") return "Compare mutual funds · Thinkbrew";
  if (tab === "all") return "All mutual funds · Thinkbrew";
  if (tab === "overlap") {
    const names = (overlapNames || []).map((n) => n.trim()).filter(Boolean);
    if (names.length >= 2) {
      const vs = names.length === 3 ? `${names[0]} vs ${names[1]} vs ${names[2]}` : `${names[0]} vs ${names[1]}`;
      return `${vs} overlap · Thinkbrew`;
    }
    return "Fund overlap checker · Thinkbrew";
  }
  return "Mutual fund screener · Thinkbrew";
}

export function fundsHubDescription(tab: FundsTab, overlapNames?: string[]): string {
  if (tab === "compare") {
    return "Compare Indian Direct Growth schemes side by side on expense ratio, Sharpe, CAGR, and AUM. Not investment advice.";
  }
  if (tab === "all") {
    return "Browse Indian active-equity mutual fund families by house, category, and AUM. Holdings books, adds and cuts. Not investment advice.";
  }
  if (tab === "overlap") {
    const names = (overlapNames || []).map((n) => n.trim()).filter(Boolean);
    if (names.length >= 2) {
      const vs = names.length === 3 ? `${names[0]} vs ${names[1]} vs ${names[2]}` : `${names[0]} vs ${names[1]}`;
      return `Stock-level overlap between ${vs}. Shared holdings, unique names, and sector overlap from the latest mutual fund books. Not investment advice.`;
    }
    return "See how much the equity books of Indian active funds overlap. Shared stocks, unique names, and sector overlap. Not investment advice.";
  }
  return "Screen Indian Direct Growth mutual funds by category, fund house, returns, and expense ratio. Not investment advice.";
}

export function shortFundLabel(name: string): string {
  return (
    name
      .replace(/\s+Direct\s+Plan\s+Growth.*$/i, "")
      .replace(/\s+-\s+Direct\s+Growth.*$/i, "")
      .replace(/\s+Direct\s+Growth.*$/i, "")
      .trim() || name
  );
}

export function shortCategoryLabel(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value) return "—";
  return value.replace(/^Equity Scheme\s*[-–:]\s*/i, "").trim() || value;
}

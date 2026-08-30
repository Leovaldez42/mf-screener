import { isActiveEquityCategory, slugifyAmc } from "./equity";

export type SchemeMetric = {
  scheme_code: string;
  name: string;
  fund_house: string;
  amc_slug: string;
  category: string;
  plan_name: string | null;
  option_name: string | null;
  is_direct: boolean;
  is_growth: boolean;
  is_active_equity: boolean;
  aum_cr: number | null;
  expense_ratio: number | null;
  sharpe_1y: number | null;
  sharpe_3y: number | null;
  sharpe_5y: number | null;
  sortino_3y: number | null;
  std_dev_3y: number | null;
  beta_3y: number | null;
  cagr_1y: number | null;
  cagr_3y: number | null;
  cagr_5y: number | null;
  cagr_7y: number | null;
  cagr_10y: number | null;
  cagr_inception: number | null;
  fetched_at?: string;
};

type Timeframe = { timeframe?: string; value?: string | number };

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function tfValue(block: { timeframes?: Timeframe[] } | undefined, period: string): number | null {
  const hit = (block?.timeframes || []).find((t) => String(t.timeframe).toLowerCase() === period);
  return parseNum(hit?.value);
}

export function isDirectPlan(planName: string | null | undefined): boolean {
  return (planName || "").toLowerCase().includes("direct");
}

export function isGrowthOption(optionName: string | null | undefined): boolean {
  const o = (optionName || "").toLowerCase();
  if (!o.includes("growth")) return false;
  if (o.includes("idcw") || o.includes("dividend")) return false;
  return true;
}

export function rowFromFinapi(raw: Record<string, unknown>): SchemeMetric | null {
  const scheme_code = String(raw.schemeCode ?? raw.scheme_code ?? "").trim();
  const name = String(raw.schemeName ?? raw.scheme_name ?? "").trim();
  if (!scheme_code || !name) return null;

  const fund_house = String(raw.fundHouse ?? raw.fund_house ?? raw.companyName ?? "").trim();
  const category = String(raw.schemeCategoryLabel ?? raw.schemeCategory ?? raw.category ?? "").trim();
  const plan_name = raw.planName != null ? String(raw.planName) : null;
  const option_name = raw.optionName != null ? String(raw.optionName) : null;
  const cagr = (raw.cagr || {}) as Record<string, unknown>;
  const rm = (raw.riskMetrics || {}) as Record<string, { timeframes?: Timeframe[] }>;

  return {
    scheme_code,
    name,
    fund_house,
    amc_slug: slugifyAmc(fund_house),
    category,
    plan_name,
    option_name,
    is_direct: isDirectPlan(plan_name),
    is_growth: isGrowthOption(option_name),
    is_active_equity: isActiveEquityCategory(category),
    aum_cr: parseNum(raw.aum),
    expense_ratio: parseNum(raw.expenseRatio ?? raw.totalExpensesRatio),
    sharpe_1y: tfValue(rm.sharpRatio, "1y"),
    sharpe_3y: tfValue(rm.sharpRatio, "3y"),
    sharpe_5y: tfValue(rm.sharpRatio, "5y"),
    sortino_3y: tfValue(rm.sortinoRatio, "3y"),
    std_dev_3y: tfValue(rm.riskStandardDeviation, "3y"),
    beta_3y: tfValue(rm.beta, "3y"),
    cagr_1y: parseNum(cagr["1y"]),
    cagr_3y: parseNum(cagr["3y"]),
    cagr_5y: parseNum(cagr["5y"]),
    cagr_7y: parseNum(cagr["7y"]),
    cagr_10y: parseNum(cagr["10y"]),
    cagr_inception: parseNum(cagr.inception),
  };
}

export const COMPARE_MAX = 6;

export const SORTABLE = [
  "sharpe_3y",
  "expense_ratio",
  "cagr_1y",
  "cagr_3y",
  "cagr_5y",
  "aum_cr",
  "name",
  "fund_house",
] as const;

export type SortKey = (typeof SORTABLE)[number];

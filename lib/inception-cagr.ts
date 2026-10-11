/** Categories seen in scheme_metrics: "Debt Scheme - …", "Hybrid Scheme - Arbitrage Fund", etc. */
const DEBT_LIKE_CATEGORY =
  /debt|liquid|overnight|money market|arbitrage/i;

export type InceptionCagrInput = {
  category?: string | null;
  cagr_inception?: number | null;
  cagr_5y?: number | null;
  cagr_3y?: number | null;
  cagr_1y?: number | null;
};

export function isDebtLikeCategory(category: string | null | undefined): boolean {
  return DEBT_LIKE_CATEGORY.test(category || "");
}

export function longestHorizonCagr(row: InceptionCagrInput): number | null {
  for (const n of [row.cagr_5y, row.cagr_3y, row.cagr_1y]) {
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

export function isInceptionCagrReliable(row: InceptionCagrInput): boolean {
  const inc = row.cagr_inception;
  if (inc == null || !Number.isFinite(inc)) return true;
  if (inc > 100) return false;
  if (isDebtLikeCategory(row.category) && inc > 15) return false;
  const longest = longestHorizonCagr(row);
  if (longest != null && Math.abs(inc - longest) > 25) return false;
  return true;
}

export function withInceptionCagrFlag<T extends InceptionCagrInput>(
  row: T,
): T & { inception_cagr_reliable: boolean } {
  return { ...row, inception_cagr_reliable: isInceptionCagrReliable(row) };
}

export function compareInceptionCagr<T extends InceptionCagrInput & { inception_cagr_reliable?: boolean }>(
  a: T,
  b: T,
  ascending: boolean,
): number {
  const ar = a.inception_cagr_reliable !== false;
  const br = b.inception_cagr_reliable !== false;
  if (ar !== br) return ar ? -1 : 1;
  const av = a.cagr_inception;
  const bv = b.cagr_inception;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return ascending ? av - bv : bv - av;
}

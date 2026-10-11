export function isDefaultHiddenScheme(row: { name?: string | null; aum_cr?: number | null }): boolean {
  if (/unclaimed/i.test(row.name || "")) return true;
  if (row.aum_cr == null) return true;
  return false;
}

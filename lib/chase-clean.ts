import type { ChaseRow } from "@/lib/types";

const NAME_JUNK =
  /\b(treps|reverse repo|cblo|tri[- ]party|cash equivalent|net (current assets|receivables?)|margin money|clearing|collateral|commercial paper|certificate of deposit|treasury bills?|t[- ]bills?|gilt|government securit|mutual fund units?|units of|preference shares?)\b/i;

const NAME_EXACT = /^(others?|other (equity|equities|assets?|investments?)|cash|nca|ncd)$/i;

const SECTOR_JUNK = /^(cash|debt|money market|cash equivalent|others?)$/i;

export function isJunkHolding(name: string, sector?: string | null): boolean {
  const n = (name || "").trim();
  if (!n || n === "Unknown") return true;
  if (NAME_EXACT.test(n) || NAME_JUNK.test(n)) return true;
  const s = (sector || "").trim();
  if (s && SECTOR_JUNK.test(s)) return true;
  return false;
}

export function cleanChaseRows(rows: ChaseRow[]): ChaseRow[] {
  return rows.filter((r) => !isJunkHolding(r.display_name, r.sector));
}

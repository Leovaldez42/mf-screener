export function formatMonthLabel(month: string | null | undefined): string {
  if (!month || month.length < 7) return "—";
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function formatMonthShort(month: string | null | undefined): string {
  if (!month || month.length < 7) return "—";
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** Newest-first YYYY-MM list → "Jan–Jul 2026" or "Dec 2025–Jul 2026". */
export function formatMonthSpan(months: string[]): string {
  if (!months.length) return "the latest available month";
  const sorted = [...months].filter(Boolean).sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return formatMonthLabel(first);
  const [y1, m1] = first.split("-").map(Number);
  const [y2, m2] = last.split("-").map(Number);
  const a = new Date(y1, m1 - 1, 1).toLocaleDateString("en-IN", { month: "short" });
  const b = new Date(y2, m2 - 1, 1).toLocaleDateString("en-IN", { month: "short" });
  if (y1 === y2) return `${a}–${b} ${y2}`;
  return `${a} ${y1}–${b} ${y2}`;
}

const JUNK_SECTOR =
  /^(unknown|n\.?a\.?|n\/a|na|-|—|–|\.|none|null|nil|not available|not applicable)$/i;
const JUNK_NUMERIC = /^[\d.,\s]+$/;

export type SectorClassification = {
  broaderIndustry?: string | null;
  industry?: string | null;
  sector?: string | null;
  broaderSector?: string | null;
};

export function isJunkSector(sector: string | null | undefined): boolean {
  const s = (sector || "").trim();
  if (!s) return true;
  if (JUNK_SECTOR.test(s)) return true;
  if (JUNK_NUMERIC.test(s)) return true;
  return false;
}

/** Trim, collapse space, drop junk. Does not rewrite FinAPI classification spelling. */
export function canonicalizeSector(raw: string): string {
  const s = (raw || "").trim().replace(/\s+/g, " ");
  if (!s || isJunkSector(s)) return "";
  return s;
}

export function normalizeSectorKey(sector: string | null | undefined): string {
  return canonicalizeSector(sector || "").toLowerCase();
}

/** Empty / missing industry labels. Matches Sectors rollup. */
export function sectorLabel(sector: string | null | undefined): string {
  const s = canonicalizeSector(sector || "");
  return s || "Unknown";
}

/**
 * FinAPI mapped tree only. Never use deprecated top-level holdings `sector`.
 * broaderIndustry → industry → sector → broaderSector.
 */
export function sectorFromHolding(h: { sectorClassification?: SectorClassification | null }): string {
  const sc = h.sectorClassification;
  if (!sc) return "";
  for (const candidate of [sc.broaderIndustry, sc.industry, sc.sector, sc.broaderSector]) {
    const n = canonicalizeSector(candidate || "");
    if (n) return n;
  }
  return "";
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

/** Compact share count for home previews, e.g. +12.4M sh. */
export function formatCompactShares(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const body =
    abs >= 1_000_000_000
      ? `${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`
      : abs >= 1_000_000
        ? `${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
        : abs >= 1_000
          ? `${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`
          : abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${sign}${body} sh`;
}

export function formatDelta(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + formatNumber(n, digits);
}

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

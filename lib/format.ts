export function formatMonthLabel(month: string | null | undefined): string {
  if (!month || month.length < 7) return "—";
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
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

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
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

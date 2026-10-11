/** API: unknown requested month is not silently replaced. */
export function pickHoldingsMonth(
  requested: string | null | undefined,
  available: string[],
): { month: string | null; unknown: boolean } {
  const latest = available[0] ?? null;
  const req = (requested || "").trim();
  if (!req) return { month: latest, unknown: false };
  if (available.includes(req)) return { month: req, unknown: false };
  return { month: null, unknown: true };
}

export function holdingsMonthEnd(month: string): Date | null {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m, 0);
}

/** Pages: show latest plus a notice instead of a blank book. */
export function pageHoldingsMonth(
  requested: string,
  available: string[],
): { month: string; unavailable: boolean } {
  const req = (requested || "").trim();
  if (!req) return { month: available[0] || "", unavailable: false };
  if (available.includes(req)) return { month: req, unavailable: false };
  return { month: available[0] || "", unavailable: available.length > 0 };
}

export function holdingsAreStale(month: string, now = new Date()): boolean {
  const end = holdingsMonthEnd(month);
  if (!end) return false;
  const days = (now.getTime() - end.getTime()) / 86_400_000;
  return days > 45;
}

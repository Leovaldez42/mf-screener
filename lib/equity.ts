/** AMFI-style active equity categories. Index / ETF / debt / gold are excluded. */
export const ACTIVE_EQUITY_CATEGORY_NEEDLES = [
  "flexi cap",
  "multi cap",
  "large cap",
  "large & mid",
  "large and mid",
  "mid cap",
  "small cap",
  "elss",
  "value",
  "contra",
  "focused",
  "dividend yield",
  "sectoral",
  "thematic",
] as const;

const SKIP_NEEDLES = [
  "index",
  "etf",
  "exchange traded",
  "gold",
  "gilt",
  "overnight",
  "liquid",
  "debt",
  "bond",
  "gilt",
  "arbitrage",
  "fund of fund",
  "fof",
];

export function slugifyAmc(name: string): string {
  return name
    .toLowerCase()
    .replace(/mutual fund/gi, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\blimited\b/g, "ltd")
    .replace(/\bltd\.?\b/g, "ltd")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const CATEGORY_STYLES = [
  { id: "large-cap", label: "Large cap", needles: ["large cap"] },
  { id: "large-mid", label: "Large & mid cap", needles: ["large & mid", "large and mid"] },
  { id: "mid-cap", label: "Mid cap", needles: ["mid cap"] },
  { id: "small-cap", label: "Small cap", needles: ["small cap"] },
  { id: "flexi-cap", label: "Flexi cap", needles: ["flexi cap"] },
  { id: "multi-cap", label: "Multi cap", needles: ["multi cap"] },
  { id: "elss", label: "ELSS", needles: ["elss"] },
  { id: "focused", label: "Focused", needles: ["focused"] },
  { id: "value", label: "Value", needles: ["value"] },
  { id: "contra", label: "Contra", needles: ["contra"] },
  { id: "dividend-yield", label: "Dividend yield", needles: ["dividend yield"] },
  { id: "sectoral-thematic", label: "Sectoral / thematic", needles: ["sectoral", "thematic"] },
] as const;

export type CategoryStyleId = (typeof CATEGORY_STYLES)[number]["id"];

export function categoryStyleOrFilter(styleId: string): string[] {
  const hit = CATEGORY_STYLES.find((s) => s.id === styleId);
  return hit ? [...hit.needles] : [];
}

export function isActiveEquityCategory(category: string | null | undefined): boolean {
  const c = (category ?? "").toLowerCase();
  if (!c) return false;
  if (SKIP_NEEDLES.some((n) => c.includes(n))) return false;
  return ACTIVE_EQUITY_CATEGORY_NEEDLES.some((n) => c.includes(n));
}

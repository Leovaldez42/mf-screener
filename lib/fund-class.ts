import { CATEGORY_STYLES, isActiveEquityCategory } from "./equity";

export const ASSET_CLASSES = [
  { id: "equity-active", label: "Active equity", short: "Equity", defaultSort: "sharpe_3y", defaultOrder: "desc" as const },
  { id: "index", label: "Index / ETF", short: "Index", defaultSort: "expense_ratio", defaultOrder: "asc" as const },
  { id: "debt", label: "Debt", short: "Debt", defaultSort: "expense_ratio", defaultOrder: "asc" as const },
  { id: "hybrid", label: "Hybrid", short: "Hybrid", defaultSort: "cagr_3y", defaultOrder: "desc" as const },
  { id: "other", label: "Other", short: "Other", defaultSort: "aum_cr", defaultOrder: "desc" as const },
] as const;

export type AssetClassId = (typeof ASSET_CLASSES)[number]["id"];

export const CLASS_TABS = [
  { id: "all", label: "All", short: "All", defaultSort: "aum_cr", defaultOrder: "desc" as const },
  ...ASSET_CLASSES,
] as const;

export type ClassTabId = (typeof CLASS_TABS)[number]["id"];

export const DEFAULT_ASSET_CLASS: AssetClassId = "equity-active";

export type ClassStyle = { id: string; label: string; needles: readonly string[] };

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

export function isAssetClassId(value: string): value is AssetClassId {
  return ASSET_CLASSES.some((c) => c.id === value);
}

export function parseAssetClass(value: string | null | undefined): AssetClassId {
  if (value && isAssetClassId(value)) return value;
  return DEFAULT_ASSET_CLASS;
}

export function isListedEtf(name: string | null | undefined, category: string | null | undefined): boolean {
  const blob = `${name ?? ""} ${category ?? ""}`.toLowerCase();
  if (blob.includes("fund of fund") || /\bfof\b/.test(blob)) return false;
  return blob.includes("etf") || blob.includes("exchange traded");
}

/** NSE tickers that do not appear in the AMFI scheme name. */
export const SEARCH_ALIASES: Record<string, string[]> = {
  mafang: ["nyse fang", "fang"],
  niftybees: ["nifty 50 bees", "nippon india etf nifty 50 bees"],
  juniorbees: ["junior bees", "next 50 bees"],
  bankbees: ["nifty bank bees", "bank bees"],
  goldbees: ["gold bees"],
  liquidbees: ["liquid bees"],
  hangsengebees: ["hang seng bees"],
};

export function searchNeedles(q: string): string[] {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  const out = new Set<string>([trimmed]);
  for (const extra of SEARCH_ALIASES[compact] || []) out.add(extra);
  if (compact.endsWith("bees") && compact.length > 4) {
    const stem = compact.slice(0, -4);
    out.add(`${stem} bees`);
    out.add(`${stem} 50 bees`);
  }
  return [...out];
}

export function assetClassFromCategory(
  category: string | null | undefined,
  name?: string | null,
): AssetClassId {
  const c = `${category ?? ""} ${name ?? ""}`.toLowerCase().trim();
  if (!c) return "other";
  if (includesAny(c, ["fund of fund", "fof"])) return "hybrid";
  if (includesAny(c, ["index", "etf", "exchange traded"])) return "index";
  if (
    includesAny(c, [
      "overnight",
      "liquid",
      "money market",
      "ultra short",
      "low duration",
      "short duration",
      "medium duration",
      "medium to long",
      "long duration",
      "dynamic bond",
      "corporate bond",
      "credit risk",
      "banking and psu",
      "banking & psu",
      "gilt",
      "floater",
      "debt fund",
      "debt scheme",
    ]) ||
    (c.includes("bond") && !c.includes("index"))
  ) {
    return "debt";
  }
  if (
    includesAny(c, [
      "hybrid",
      "balanced",
      "arbitrage",
      "fund of fund",
      "fof",
      "equity savings",
      "multi asset",
      "dynamic asset",
    ])
  ) {
    return "hybrid";
  }
  if (includesAny(c, ["gold", "silver", "international", "overseas", "retirement", "children", "solution"])) {
    return "other";
  }
  if (isActiveEquityCategory(category)) return "equity-active";
  return "other";
}

export function classShowsPe(assetClass: AssetClassId): boolean {
  return assetClass === "equity-active";
}

export const CLASS_STYLES: Record<AssetClassId, ClassStyle[]> = {
  "equity-active": CATEGORY_STYLES.map((s) => ({ id: s.id, label: s.label, needles: s.needles })),
  index: [
    { id: "nifty", label: "Nifty", needles: ["nifty"] },
    { id: "nifty-50", label: "Nifty 50", needles: ["nifty 50"] },
    { id: "sensex", label: "Sensex", needles: ["sensex"] },
    { id: "next-50", label: "Nifty Next 50", needles: ["next 50"] },
    { id: "midcap-index", label: "Midcap index", needles: ["midcap", "mid cap"] },
    { id: "smallcap-index", label: "Smallcap index", needles: ["smallcap", "small cap"] },
    { id: "etf", label: "ETF", needles: ["etf", "exchange traded"] },
  ],
  debt: [
    { id: "overnight", label: "Overnight", needles: ["overnight"] },
    { id: "liquid", label: "Liquid", needles: ["liquid"] },
    { id: "money-market", label: "Money market", needles: ["money market"] },
    { id: "ultra-short", label: "Ultra short", needles: ["ultra short"] },
    { id: "low-duration", label: "Low duration", needles: ["low duration"] },
    { id: "short-duration", label: "Short duration", needles: ["short duration"] },
    { id: "gilt", label: "Gilt", needles: ["gilt"] },
    { id: "corporate-bond", label: "Corporate bond", needles: ["corporate bond"] },
    { id: "credit-risk", label: "Credit risk", needles: ["credit risk"] },
    { id: "banking-psu", label: "Banking & PSU", needles: ["banking and psu", "banking & psu"] },
    { id: "dynamic-bond", label: "Dynamic bond", needles: ["dynamic bond"] },
    { id: "floater", label: "Floater", needles: ["floater"] },
  ],
  hybrid: [
    { id: "aggressive-hybrid", label: "Aggressive hybrid", needles: ["aggressive hybrid"] },
    { id: "conservative-hybrid", label: "Conservative hybrid", needles: ["conservative hybrid"] },
    { id: "balanced-advantage", label: "Balanced advantage", needles: ["balanced advantage", "dynamic asset"] },
    { id: "arbitrage", label: "Arbitrage", needles: ["arbitrage"] },
    { id: "equity-savings", label: "Equity savings", needles: ["equity savings"] },
    { id: "multi-asset", label: "Multi asset", needles: ["multi asset"] },
    { id: "fof", label: "Fund of funds", needles: ["fund of fund", "fof"] },
  ],
  other: [
    { id: "gold", label: "Gold", needles: ["gold"] },
    { id: "silver", label: "Silver", needles: ["silver"] },
    { id: "international", label: "International", needles: ["international", "overseas"] },
    { id: "retirement", label: "Retirement", needles: ["retirement"] },
  ],
};

export function parseStyleIds(raw: string | null | undefined): string[] {
  return [...new Set((raw || "").split(",").map((s) => s.trim()).filter(Boolean))];
}

export function classStyleOrFilter(assetClass: AssetClassId, styleId: string): string[] {
  const hit = CLASS_STYLES[assetClass].find((s) => s.id === styleId);
  return hit ? [...hit.needles] : [];
}

export function classStylesOrFilter(assetClass: AssetClassId, styleIds: string[]): string[] {
  const needles = new Set<string>();
  for (const id of styleIds) {
    for (const n of classStyleOrFilter(assetClass, id)) needles.add(n);
  }
  return [...needles];
}

/** Index names live in the scheme title; SEBI category is often just "ETF" / "Index Funds". */
export function styleMatchOrFilter(needles: string[]): string {
  return needles.flatMap((n) => [`name.ilike.%${n}%`, `category.ilike.%${n}%`]).join(",");
}

export function assetClassMeta(id: AssetClassId) {
  return ASSET_CLASSES.find((c) => c.id === id)!;
}

export function classTabMeta(id: ClassTabId) {
  return CLASS_TABS.find((c) => c.id === id)!;
}

import { getFundDirectory, getStockDirectory } from "@/lib/directory";
import { listCompleteMonths } from "@/lib/holdings-month";
import { SEARCH_ALIASES } from "@/lib/search-aliases";

export type SearchHit = {
  kind: "fund" | "stock";
  id: string;
  href: string;
  title: string;
  subtitle: string;
};

export type SearchSuggestion = {
  label: string;
  href: string;
};

export type SearchResponse = {
  month: string | null;
  funds: SearchHit[];
  stocks: SearchHit[];
  suggestions: SearchSuggestion[];
  lead: "funds" | "stocks";
  fundTotal: number;
  stockTotal: number;
};

export type IndexedFund = {
  id: number;
  name: string;
  house: string;
  category: string;
  aum_cr: number;
};

export type IndexedStock = {
  id: string;
  name: string;
  isin: string;
  sector: string;
  fund_count: number;
};

export type SearchIndex = {
  month: string;
  funds: IndexedFund[];
  stocks: IndexedStock[];
  suggestions: SearchSuggestion[];
};

const LIMIT = 5;
const STOP = new Set(["limited", "ltd", "fund", "direct", "growth"]);

let mem: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ")
    .trim();
}

function chipLabel(name: string) {
  return name.replace(/\s+(Limited|Ltd\.?|Fund)$/i, "").trim() || name;
}

export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (n === m) {
      i += 1;
      j += 1;
    } else if (n < m) {
      j += 1;
    } else {
      i += 1;
    }
  }
  if (i < n || j < m) edits += 1;
  return edits <= 1;
}

function expandedQueries(query: string): string[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const out = new Set<string>([q]);
  for (const [alias, targets] of Object.entries(SEARCH_ALIASES)) {
    const a = normalizeSearchText(alias);
    if (!a) continue;
    if (q === a || q.startsWith(`${a} `) || q.endsWith(` ${a}`) || q.includes(` ${a} `)) {
      for (const t of targets) out.add(normalizeSearchText(t));
    }
  }
  return [...out];
}

/** Ranked word match. Never scores scattered-letter subsequences. */
export function matchScore(haystack: string, query: string): number {
  const hay = normalizeSearchText(haystack);
  const needles = expandedQueries(query);
  let best = 0;
  for (const q of needles) {
    best = Math.max(best, scoreNormalized(hay, q));
  }
  return best;
}

function scoreNormalized(hay: string, q: string): number {
  if (!q || !hay) return 0;
  if (hay === q) return 100;
  if (hay.startsWith(q)) return 80;
  const words = hay.split(" ").filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (q.length >= 4 && hay.includes(q)) return 40;
  if (q.length >= 5 && Math.abs(hay.length - q.length) <= 1 && withinOneEdit(hay, q)) return 20;
  if (q.length >= 6 && words.some((w) => withinOneEdit(w, q))) return 20;
  return 0;
}

function isinScore(isin: string, query: string): number {
  const needle = query.trim().toLowerCase().replace(/\s+/g, "");
  const hay = isin.trim().toLowerCase();
  if (!needle || !hay) return 0;
  if (hay === needle) return 100;
  if (hay.startsWith(needle) && needle.length >= 4) return 80;
  return 0;
}

async function buildIndex(): Promise<SearchIndex> {
  const months = await listCompleteMonths();
  const month = months[0] ?? "";
  const [fundsRaw, stockDir] = await Promise.all([getFundDirectory(), getStockDirectory()]);
  const funds: IndexedFund[] = fundsRaw.map((f) => ({
    id: f.id,
    name: f.name,
    house: f.house,
    category: f.category,
    aum_cr: f.aum_cr ?? 0,
  }));
  const stocks: IndexedStock[] = stockDir.stocks.map((s) => ({
    id: s.id,
    name: s.name,
    isin: (s.isin || "").trim(),
    sector: s.sector,
    fund_count: s.fund_count,
  }));

  const topFund = [...funds].sort((a, b) => b.aum_cr - a.aum_cr || a.name.localeCompare(b.name))[0];
  const topStocks = [...stocks].sort((a, b) => b.fund_count - a.fund_count || a.name.localeCompare(b.name)).slice(0, 2);
  const categoryCounts = new Map<string, { n: number; aum: number }>();
  for (const f of funds) {
    const key = f.category || "Uncategorised";
    const cur = categoryCounts.get(key) || { n: 0, aum: 0 };
    cur.n += 1;
    cur.aum += f.aum_cr;
    categoryCounts.set(key, cur);
  }
  const topCategory = [...categoryCounts.entries()]
    .map(([name, v]) => ({
      raw: name,
      label: name.replace(/^Equity Scheme\s*[-–]\s*/i, "").trim(),
      ...v,
    }))
    .filter((c) => c.label && c.label !== "Uncategorised" && c.label.length <= 28)
    .sort((a, b) => b.n - a.n || b.aum - a.aum)[0];

  const suggestions: SearchSuggestion[] = [];
  if (topFund) suggestions.push({ label: chipLabel(topFund.name), href: `/funds/${topFund.id}` });
  for (const s of topStocks) suggestions.push({ label: chipLabel(s.name), href: `/stocks/${s.id}` });
  if (topCategory) {
    suggestions.push({
      label: /fund/i.test(topCategory.label) ? topCategory.label : `${topCategory.label} funds`,
      href: `/funds?q=${encodeURIComponent(topCategory.raw)}`,
    });
  }

  return { month, funds, stocks, suggestions: suggestions.slice(0, 4) };
}

export async function getSearchIndex(): Promise<SearchIndex> {
  const months = await listCompleteMonths();
  const month = months[0] ?? "";
  if (mem && mem.month === month) return mem;
  if (inflight) return inflight;
  inflight = buildIndex()
    .then((idx) => {
      mem = idx;
      return idx;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function fundScore(f: IndexedFund, query: string): number {
  return Math.max(matchScore(f.name, query), matchScore(f.house, query), matchScore(f.category, query));
}

function stockScore(s: IndexedStock, query: string): number {
  return Math.max(matchScore(s.name, query), matchScore(s.sector, query), isinScore(s.isin, query));
}

export function searchCatalogFrom(index: SearchIndex, q: string, limit = LIMIT): SearchResponse {
  const needle = q.trim();
  const empty: SearchResponse = {
    month: index.month || null,
    funds: [],
    stocks: [],
    suggestions: index.suggestions,
    lead: "funds",
    fundTotal: 0,
    stockTotal: 0,
  };
  if (!normalizeSearchText(needle) && !needle.trim()) return empty;

  const fundsRanked = index.funds
    .map((f) => ({
      hit: {
        kind: "fund" as const,
        id: String(f.id),
        href: `/funds/${f.id}`,
        title: f.name,
        subtitle: [f.house, f.category].filter(Boolean).join(" · "),
      },
      score: fundScore(f, needle),
      tie: f.aum_cr,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.tie - a.tie || a.hit.title.localeCompare(b.hit.title));

  const stocksRanked = index.stocks
    .map((s) => ({
      hit: {
        kind: "stock" as const,
        id: s.id,
        href: `/stocks/${s.id}`,
        title: s.name,
        subtitle: [s.sector, s.isin].filter(Boolean).join(" · "),
      },
      score: stockScore(s, needle),
      tie: s.fund_count,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.tie - a.tie || a.hit.title.localeCompare(b.hit.title));

  const topFund = fundsRanked[0]?.score ?? 0;
  const topStock = stocksRanked[0]?.score ?? 0;
  const lead: "funds" | "stocks" = topStock > topFund ? "stocks" : "funds";

  return {
    month: index.month || null,
    funds: fundsRanked.slice(0, limit).map((x) => x.hit),
    stocks: stocksRanked.slice(0, limit).map((x) => x.hit),
    suggestions: index.suggestions,
    lead,
    fundTotal: fundsRanked.length,
    stockTotal: stocksRanked.length,
  };
}

export async function searchCatalog(q: string, limit = LIMIT): Promise<SearchResponse> {
  const index = await getSearchIndex();
  return searchCatalogFrom(index, q, limit);
}

import { getFundDirectory, getStockDirectory } from "@/lib/directory";
import { listCompleteMonths } from "@/lib/holdings-month";
import {
  chipLabel,
  searchCatalogFrom,
  type IndexedFund,
  type IndexedStock,
  type SearchIndex,
  type SearchResponse,
  type SearchSuggestion,
} from "@/lib/search";

let mem: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

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
  if (process.env.SNAPSHOT_BUILD !== "1") {
    try {
      const { getSiteMeta } = await import("@/lib/snapshot-read");
      const meta = await getSiteMeta();
      if (meta?.searchIndex) return meta.searchIndex;
    } catch {
      /* fall through */
    }
  }
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

export async function searchCatalog(q: string, limit?: number): Promise<SearchResponse> {
  const index = await getSearchIndex();
  return searchCatalogFrom(index, q, limit);
}

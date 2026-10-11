import { unstable_cache } from "next/cache";
import {
  OVERLAP_MAX_FUNDS,
  OVERLAP_MIN_FUNDS,
  alignBooks,
  allPairs,
  holdingsInAll,
  pickOverlapMonth,
  uniqueHoldings,
  type OverlapLine,
} from "@/lib/fund-overlap";
import { listCompleteMonths, listFamilyMonths } from "@/lib/holdings-month";
import { CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import { asOne } from "@/lib/rel";
import { createAnonClient, fetchAllRows } from "@/lib/supabase";

export type OverlapFundInfo = {
  code: string;
  name: string;
  category: string;
  aum_cr: number | null;
  holdings_count: number;
  months: string[];
};

export type OverlapSuggestion = {
  codes: string[];
  names: string[];
  category: string;
};

function parseCodes(raw: string): string[] {
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

export function parseOverlapFunds(raw: string | null): string[] {
  return parseCodes(raw || "").slice(0, OVERLAP_MAX_FUNDS);
}

async function loadFundMeta(codes: string[]) {
  const ids = codes.map((c) => Number(c));
  const db = createAnonClient();
  const { data: families, error } = await db
    .from("families")
    .select("id, name, sebi_category")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map((families || []).map((f) => [String(f.id), f]));
  const unknown = codes.filter((c) => !byId.has(c) || !Number.isFinite(Number(c)));
  if (unknown.length) {
    return { error: "unknown_codes" as const, unknown };
  }
  const { data: metrics } = await db
    .from("scheme_metrics")
    .select("scheme_code, aum_cr, category")
    .in("scheme_code", codes);
  const metricBy = new Map((metrics || []).map((m) => [String(m.scheme_code), m]));
  const complete = await listCompleteMonths();
  const monthsByCode = new Map<string, string[]>();
  await Promise.all(
    codes.map(async (code) => {
      monthsByCode.set(code, await listFamilyMonths(db, Number(code), complete));
    }),
  );
  const funds: OverlapFundInfo[] = codes.map((code) => {
    const fam = byId.get(code)!;
    const metric = metricBy.get(code);
    return {
      code,
      name: String(fam.name),
      category: String(metric?.category || fam.sebi_category || ""),
      aum_cr: metric?.aum_cr == null ? null : Number(metric.aum_cr),
      holdings_count: 0,
      months: monthsByCode.get(code) || [],
    };
  });
  return { funds, monthsByCode };
}

async function loadBooks(codes: string[], month: string) {
  const db = createAnonClient();
  const books: { code: string; holdings: OverlapLine[] }[] = [];
  for (const code of codes) {
    const snaps = await fetchAllRows<{
      stock_id: string;
      weight_pct: number;
      stocks: unknown;
    }>(() =>
      db
        .from("holdings_snapshots")
        .select("stock_id, weight_pct, stocks(display_name, sector, isin)")
        .eq("family_id", Number(code))
        .eq("month", month),
    );
    const holdings: OverlapLine[] = snaps.map((s) => {
      const st = asOne(s.stocks);
      return {
        stock_id: s.stock_id as string,
        display_name: String(st?.display_name ?? "Unknown"),
        sector: (st?.sector as string | null) ?? null,
        isin: (st?.isin as string | null) ?? null,
        weight_pct: Number(s.weight_pct) || 0,
      };
    });
    books.push({ code, holdings });
  }
  return alignBooks(books);
}

async function loadOverlap(codes: string[], requestedMonth: string) {
  if (codes.length < OVERLAP_MIN_FUNDS) {
    return { error: "need_two_funds" as const };
  }
  if (codes.length > OVERLAP_MAX_FUNDS) {
    return { error: "too_many_funds" as const };
  }
  const meta = await loadFundMeta(codes);
  if ("error" in meta) return meta;

  const lists = codes.map((c) => meta.monthsByCode.get(c) || []);
  const picked = pickOverlapMonth(requestedMonth, lists);
  if (picked.unknown || !picked.month) {
    return {
      error: "unknown_month" as const,
      availableMonths: picked.commonMonths,
    };
  }

  const aligned = await loadBooks(codes, picked.month);
  const pairs = allPairs(aligned);
  const funds = meta.funds.map((f) => {
    const book = aligned.find((b) => b.code === f.code);
    return { ...f, holdings_count: book?.holdings.length ?? 0 };
  });
  const unique: Record<string, OverlapLine[]> = {};
  for (const f of funds) unique[f.code] = uniqueHoldings(aligned, f.code, 10);
  const singleMonth = funds.filter((f) => f.months.length === 1).map((f) => f.code);

  return {
    funds,
    month: picked.month,
    availableMonths: picked.commonMonths,
    pairs,
    common: pairs.length === 1 ? pairs[0].common : holdingsInAll(aligned),
    commonAll: aligned.length >= 3 ? holdingsInAll(aligned) : [],
    unique,
    singleMonthFunds: singleMonth,
  };
}

export const getOverlap = unstable_cache(loadOverlap, ["fund-overlap-v1"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS],
});

async function loadOverlapSuggestions(): Promise<OverlapSuggestion[]> {
  const db = createAnonClient();
  const { data: families, error } = await db
    .from("families")
    .select("id, name, sebi_category")
    .eq("has_holdings", true)
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = families || [];
  if (!rows.length) return [];
  const codes = rows.map((f) => String(f.id));
  const metrics: { scheme_code: string; aum_cr: number | null; category: string | null }[] = [];
  for (let i = 0; i < codes.length; i += 200) {
    const chunk = codes.slice(i, i + 200);
    const { data, error: mErr } = await db
      .from("scheme_metrics")
      .select("scheme_code, aum_cr, category")
      .in("scheme_code", chunk);
    if (mErr) throw new Error(mErr.message);
    metrics.push(...((data || []) as typeof metrics));
  }
  const aumBy = new Map(metrics.map((m) => [String(m.scheme_code), Number(m.aum_cr) || 0]));
  const catBy = new Map(
    metrics.map((m) => [String(m.scheme_code), String(m.category || "")]),
  );
  type Row = { code: string; name: string; category: string; aum: number };
  const byCat = new Map<string, Row[]>();
  for (const f of rows) {
    const code = String(f.id);
    const category = catBy.get(code) || String(f.sebi_category || "");
    if (!category) continue;
    const list = byCat.get(category) || [];
    list.push({
      code,
      name: String(f.name),
      category,
      aum: aumBy.get(code) || 0,
    });
    byCat.set(category, list);
  }
  const pairs: OverlapSuggestion[] = [];
  const rankedCats = [...byCat.entries()]
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => b.aum - a.aum);
      return { category, list: sorted, topAum: sorted[0]?.aum || 0 };
    })
    .filter((c) => c.list.length >= 2)
    .sort((a, b) => b.topAum - a.topAum);
  for (const cat of rankedCats) {
    const [x, y] = cat.list;
    if (!x || !y) continue;
    pairs.push({
      codes: [x.code, y.code],
      names: [x.name, y.name],
      category: cat.category,
    });
    if (pairs.length >= 4) break;
  }
  return pairs;
}

export const getOverlapSuggestions = unstable_cache(loadOverlapSuggestions, ["overlap-suggest-v1"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS],
});

export async function loadOverlapPage(codes: string[], requestedMonth: string) {
  if (codes.length < 2) {
    return { data: null, error: null, suggestions: await getOverlapSuggestions() };
  }
  const payload = await getOverlap(codes, requestedMonth);
  if ("error" in payload && payload.error === "unknown_month") {
    const latest = payload.availableMonths[0];
    if (!latest) {
      return {
        data: payload,
        error: "These funds have no month in common yet.",
        suggestions: [] as OverlapSuggestion[],
      };
    }
    const retry = await getOverlap(codes, latest);
    if ("error" in retry) {
      return {
        data: payload,
        error: retry.error ?? "Could not load overlap",
        suggestions: [] as OverlapSuggestion[],
      };
    }
    return {
      data: { ...retry, availableMonths: payload.availableMonths },
      error: null,
      suggestions: [] as OverlapSuggestion[],
    };
  }
  if ("error" in payload) {
    const message =
      payload.error === "unknown_codes"
        ? "One of those fund codes is not in the holdings book."
        : payload.error === "too_many_funds"
          ? "Overlap compares two or three funds."
          : payload.error === "need_two_funds"
            ? "Add two or three funds to see overlap."
            : payload.error ?? "Could not load overlap";
    return { data: null, error: message, suggestions: [] as OverlapSuggestion[] };
  }
  return { data: payload, error: null, suggestions: [] as OverlapSuggestion[] };
}

export async function overlapFundNames(codes: string[]): Promise<string[]> {
  if (codes.length < 2) return [];
  const db = createAnonClient();
  const { data } = await db
    .from("families")
    .select("id, name")
    .in("id", codes.map((c) => Number(c)).filter(Number.isFinite));
  const by = new Map((data || []).map((f) => [String(f.id), String(f.name)]));
  return codes.map((c) => by.get(c) || c);
}

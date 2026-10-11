import { after } from "next/server";
import { unstable_cache } from "next/cache";
import { getCanonicalBook, getHoldingsCoverage } from "@/lib/cached-holdings";
import { listCompleteMonths } from "@/lib/holdings-month";
import { CACHE_TAG_HOLDINGS, HOLDINGS_REVALIDATE_SEC } from "@/lib/http-cache";
import { createAnonClient, fetchAllRows } from "@/lib/supabase";
import { buildMonthlyReport, type MonthlyReport } from "@/lib/monthly-report";

const ARCHIVE_REVALIDATE_SEC = 60 * 60 * 24 * 30;

async function loadMonthlyReport(month: string): Promise<MonthlyReport> {
  const db = createAnonClient();
  const [book, families, amcs, coverage, metrics] = await Promise.all([
    getCanonicalBook(month),
    fetchAllRows<{ id: number; name: string; amc_slug: string | null }>(() =>
      db.from("families").select("id, name, amc_slug"),
    ),
    fetchAllRows<{ slug: string; name: string }>(() => db.from("amcs").select("slug, name")),
    getHoldingsCoverage(month),
    fetchAllRows<{ scheme_code: string; aum_cr: number | null }>(() =>
      db.from("scheme_metrics").select("scheme_code, aum_cr"),
    ),
  ]);

  const amcNames: Record<string, string> = {};
  for (const a of amcs) {
    const slug = (a.slug || "").trim().toLowerCase();
    if (slug) amcNames[slug] = a.name;
  }
  const slugByFamily = new Map(
    families.map((f) => [String(f.id), (f.amc_slug || "").trim().toLowerCase()]),
  );
  const amcAum: Record<string, number> = {};
  for (const m of metrics) {
    const slug = slugByFamily.get(String(m.scheme_code));
    if (!slug) continue;
    amcAum[slug] = (amcAum[slug] || 0) + (Number(m.aum_cr) || 0);
  }

  return buildMonthlyReport({
    month,
    diffs: book.deltas.map((d) => ({
      family_id: d.family_id,
      stock_id: d.stock_id,
      display_name: d.display_name,
      sector: d.sector,
      isin: d.isin,
      qty_delta: d.qty_delta,
      value_delta_cr: d.value_delta_cr,
      event: d.event,
      qty: d.qty,
      prevQty: d.prevQty,
    })),
    currentFamilyIds: book.currentFamilyIds,
    priorFamilyIds: book.priorFamilyIds,
    priorHoldings: book.deltas
      .filter((d) => d.prevQty > 0)
      .map((d) => ({
        family_id: d.family_id,
        stock_id: d.stock_id,
        display_name: d.display_name,
        sector: d.sector,
        isin: d.isin,
      })),
    families: families.map((f) => ({
      id: Number(f.id),
      name: String(f.name || ""),
      amc_slug: (f.amc_slug || "").trim().toLowerCase(),
    })),
    amcNames,
    amcAum,
    fundHousesTotal: coverage.total,
  });
}

const getMonthlyReportLatest = unstable_cache(loadMonthlyReport, ["monthly-report-v4-latest"], {
  revalidate: HOLDINGS_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

const getMonthlyReportArchive = unstable_cache(loadMonthlyReport, ["monthly-report-v4-archive"], {
  revalidate: ARCHIVE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

export async function getMonthlyReport(month: string, latestMonth?: string) {
  const latest = latestMonth ?? (await listCompleteMonths())[0];
  if (month === latest) return getMonthlyReportLatest(month);
  return getMonthlyReportArchive(month);
}

export function precomputeOlderReports(latest: string, months: string[]) {
  after(() => {
    for (const m of months) {
      if (m === latest) continue;
      void getMonthlyReportArchive(m);
    }
  });
}

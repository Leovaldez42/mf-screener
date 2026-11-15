import { unstable_cache } from "next/cache";
import type { DataFreshness } from "@/lib/data-freshness";
import type { FundDirectoryRow, StockDirectoryRow } from "@/lib/directory";
import { CACHE_TAG_HOLDINGS, PAGE_REVALIDATE_SEC } from "@/lib/http-cache";
import type { MonthlyReport } from "@/lib/monthly-report";
import type { SearchIndex } from "@/lib/search";
import { createAnonClient } from "@/lib/supabase";
import type { ChaseRow } from "@/lib/types";

export const SITE_META_KEY = "meta";

export type ReportSnapshotPayload = {
  report: MonthlyReport;
  chase: ChaseRow[];
  sectors: { sector: string; net_value_delta_cr: number; net_qty_delta: number }[];
  excludedNoPriorMonth: number;
  coverage: { month: string; have: number; total: number; pct: number };
};

export type SiteMetaSnapshot = {
  months: string[];
  freshness: DataFreshness;
  topFundIds: number[];
  topStockIds: string[];
  fundDirectory: FundDirectoryRow[];
  stockDirectory: { month: string | null; stocks: StockDirectoryRow[] };
  reportHeadlines: { month: string; headline: string }[];
  overlapSuggestions: { codes: string[]; names: string[]; category: string }[];
  searchIndex: SearchIndex;
};

function missingSnapshotTable(error: { message?: string; code?: string } | null): boolean {
  const msg = error?.message || "";
  return /could not find the table|schema cache|does not exist/i.test(msg) || error?.code === "PGRST205";
}

async function loadSiteMeta(): Promise<SiteMetaSnapshot | null> {
  const db = createAnonClient();
  const { data, error } = await db.from("site_snapshot").select("payload").eq("key", SITE_META_KEY).maybeSingle();
  if (error) {
    if (missingSnapshotTable(error)) return null;
    throw new Error(error.message);
  }
  return (data?.payload as SiteMetaSnapshot) || null;
}

export const getSiteMeta = unstable_cache(loadSiteMeta, ["site-meta-v1"], {
  revalidate: PAGE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadReportSnapshot(month: string): Promise<ReportSnapshotPayload | null> {
  const db = createAnonClient();
  const { data, error } = await db.from("report_snapshot").select("payload").eq("month", month).maybeSingle();
  if (error) {
    if (missingSnapshotTable(error)) return null;
    throw new Error(error.message);
  }
  return (data?.payload as ReportSnapshotPayload) || null;
}

export const getReportSnapshot = unstable_cache(loadReportSnapshot, ["report-snapshot-v1"], {
  revalidate: PAGE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadFundSnapshot(familyId: number, month: string) {
  const db = createAnonClient();
  const { data, error } = await db
    .from("fund_snapshot")
    .select("payload")
    .eq("family_id", familyId)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    if (missingSnapshotTable(error)) return null;
    throw new Error(error.message);
  }
  return data?.payload ?? null;
}

export const getFundSnapshot = unstable_cache(loadFundSnapshot, ["fund-snapshot-v1"], {
  revalidate: PAGE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadLatestFundSnapshot(familyId: number) {
  const db = createAnonClient();
  const { data, error } = await db
    .from("fund_snapshot")
    .select("month, payload")
    .eq("family_id", familyId)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingSnapshotTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? { month: String(data.month), payload: data.payload } : null;
}

export const getLatestFundSnapshot = unstable_cache(loadLatestFundSnapshot, ["fund-snapshot-latest-v1"], {
  revalidate: PAGE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadStockSnapshot(stockId: string, month: string) {
  const db = createAnonClient();
  const { data, error } = await db
    .from("stock_snapshot")
    .select("payload")
    .eq("stock_id", stockId)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    if (missingSnapshotTable(error)) return null;
    throw new Error(error.message);
  }
  return data?.payload ?? null;
}

export const getStockSnapshot = unstable_cache(loadStockSnapshot, ["stock-snapshot-v1"], {
  revalidate: PAGE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

async function loadLatestStockSnapshot(stockId: string) {
  const db = createAnonClient();
  const { data, error } = await db
    .from("stock_snapshot")
    .select("month, payload")
    .eq("stock_id", stockId)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingSnapshotTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? { month: String(data.month), payload: data.payload } : null;
}

export const getLatestStockSnapshot = unstable_cache(loadLatestStockSnapshot, ["stock-snapshot-latest-v1"], {
  revalidate: PAGE_REVALIDATE_SEC,
  tags: [CACHE_TAG_HOLDINGS],
});

export async function snapshotMonths(): Promise<string[]> {
  const meta = await getSiteMeta();
  return meta?.months || [];
}

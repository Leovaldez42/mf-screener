import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadCanonicalBook } from "../lib/cached-holdings";
import { loadOverlapSuggestions } from "../lib/cached-overlap";
import { getDataFreshness } from "../lib/data-freshness";
import { getFundDirectory, getStockDirectory } from "../lib/directory";
import { queryCompleteMonthsFromHoldings } from "../lib/holdings-month";
import { getSearchIndex } from "../lib/search-index";
import {
  fundPayloadFromBook,
  headlinesFromReports,
  reportArtifactsFromBook,
  siteMetaPayload,
  stockPayloadFromBook,
  topIds,
} from "../lib/snapshot-build";
import { notifyRevalidate } from "../lib/notify-revalidate";
import { SITE_META_KEY } from "../lib/snapshot-read";
import { createAnonClient, createServiceClient, fetchAllRows } from "../lib/supabase";

process.env.SNAPSHOT_BUILD = "1";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      /* missing file is fine */
    }
  }
}

loadEnv();

type FamilyRow = {
  id: number;
  name: string;
  amc_slug: string | null;
  sebi_category: string | null;
  is_active_equity: boolean | null;
  has_holdings: boolean | null;
  latest_month: string | null;
};

async function upsertChunks<T extends Record<string, unknown>>(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  rows: T[],
  onConflict: string,
) {
  const size = 40;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await db.from(table).upsert(chunk as never, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

function coverageFor(month: string, familyIds: number[], families: FamilyRow[]) {
  const haveFamilies = new Set(familyIds);
  const amcOf = (slug: string | null) => (slug || "").trim().toLowerCase();
  const totalAmcs = new Set(families.map((f) => amcOf(f.amc_slug)).filter(Boolean));
  const haveAmcs = new Set(
    families.filter((f) => haveFamilies.has(Number(f.id))).map((f) => amcOf(f.amc_slug)).filter(Boolean),
  );
  const total = totalAmcs.size || families.length;
  const have = haveAmcs.size;
  return { month, have, total, pct: total > 0 ? Math.round((have / total) * 100) : 100 };
}

async function main() {
  const only = (process.env.SNAPSHOT_MONTH || "").trim();
  const siteOnly = process.env.SNAPSHOT_SITE_ONLY === "1";
  const db = createServiceClient();
  const anon = createAnonClient();
  const monthsAll = await queryCompleteMonthsFromHoldings();
  const months = only ? monthsAll.filter((m) => m === only) : monthsAll;
  if (!months.length) {
    throw new Error(only ? `No holdings for ${only}` : "No complete holdings months");
  }
  console.log(`snapshots: ${months.join(", ")}`);

  const [families, amcs, metrics] = await Promise.all([
    fetchAllRows<FamilyRow>(() =>
      anon
        .from("families")
        .select("id, name, amc_slug, sebi_category, is_active_equity, has_holdings, latest_month")
        .order("id"),
    ),
    fetchAllRows<{ slug: string; name: string }>(() => anon.from("amcs").select("slug, name").order("slug")),
    fetchAllRows<{ scheme_code: string; aum_cr: number | null }>(() =>
      anon.from("scheme_metrics").select("scheme_code, aum_cr").order("scheme_code"),
    ),
  ]);
  const familyById = new Map(families.map((f) => [Number(f.id), f]));
  const amcNames: Record<string, string> = {};
  for (const a of amcs) {
    const slug = (a.slug || "").trim().toLowerCase();
    if (slug) amcNames[slug] = a.name;
  }
  const slugByFamily = new Map(families.map((f) => [String(f.id), (f.amc_slug || "").trim().toLowerCase()]));
  const amcAum: Record<string, number> = {};
  const aumByFamily = new Map<number, number | null>();
  for (const m of metrics) {
    aumByFamily.set(Number(m.scheme_code), m.aum_cr == null ? null : Number(m.aum_cr));
    const slug = slugByFamily.get(String(m.scheme_code));
    if (!slug) continue;
    amcAum[slug] = (amcAum[slug] || 0) + (Number(m.aum_cr) || 0);
  }

  const familyMonths = new Map<number, string[]>();
  const stockHistory = new Map<string, { month: string; fund_count: number; fund_count_delta: number }[]>();
  const pendingStock = new Map<string, { month: string; payload: ReturnType<typeof stockPayloadFromBook> }[]>();
  const reports: { month: string; report: ReportSnapshotWait }[] = [];

  type ReportSnapshotWait = ReturnType<typeof reportArtifactsFromBook>["report"];

  if (siteOnly) {
    const saved = await fetchAllRows<{ month: string; payload: { report: ReportSnapshotWait } }>(() =>
      db.from("report_snapshot").select("month, payload").order("month", { ascending: false }),
    );
    const byMonth = new Map(saved.map((row) => [row.month, row.payload.report]));
    for (const month of months) {
      const report = byMonth.get(month);
      if (report) reports.push({ month, report });
    }
    console.log(`site only: ${reports.length} saved reports`);
  }

  for (const month of siteOnly ? [] : months) {
    const started = Date.now();
    const book = await loadCanonicalBook(month);
    const coverage = coverageFor(month, book.currentFamilyIds, families);
    const extras = {
      families: families.map((f) => ({
        id: Number(f.id),
        name: String(f.name || ""),
        amc_slug: (f.amc_slug || "").trim().toLowerCase(),
      })),
      amcNames,
      amcAum,
      coverage,
    };
    const reportPayload = reportArtifactsFromBook(book, extras);
    reports.push({ month, report: reportPayload.report });
    const { error: rErr } = await db.from("report_snapshot").upsert(
      { month, payload: reportPayload, updated_at: new Date().toISOString() },
      { onConflict: "month" },
    );
    if (rErr) throw new Error(`report_snapshot: ${rErr.message}`);

    for (const id of book.currentFamilyIds) {
      const list = familyMonths.get(id) || [];
      list.push(month);
      familyMonths.set(id, list);
    }

    const fundRows = book.currentFamilyIds
      .map((id) => familyById.get(id))
      .filter((f): f is FamilyRow => Boolean(f))
      .map((family) => {
        const availableMonths = (familyMonths.get(Number(family.id)) || []).slice().sort((a, b) => b.localeCompare(a));
        return {
          family_id: Number(family.id),
          month,
          payload: fundPayloadFromBook(
            book,
            { ...family, is_active_equity: family.is_active_equity ?? undefined, has_holdings: family.has_holdings ?? undefined },
            aumByFamily.get(Number(family.id)) ?? null,
            availableMonths,
          ),
          updated_at: new Date().toISOString(),
        };
      });
    await upsertChunks(db, "fund_snapshot", fundRows, "family_id,month");
    // availableMonths patched after every month is known

    for (const row of book.chase) {
      const hist = stockHistory.get(row.stock_id) || [];
      hist.push({ month, fund_count: row.fund_count, fund_count_delta: row.fund_count_delta });
      stockHistory.set(row.stock_id, hist);
    }

    const stockIds = [...new Set(book.chase.map((r) => r.stock_id))];
    for (const id of stockIds) {
      const meta = book.stocks[id];
      const stub = {
        id,
        display_name: meta?.display_name || "",
        sector: meta?.sector ?? null,
        isin: meta?.isin ?? null,
      };
      const payload = stockPayloadFromBook(book, id, stub, familyById, []);
      const list = pendingStock.get(id) || [];
      list.push({ month, payload });
      pendingStock.set(id, list);
    }
    console.log(`  ${month}: funds ${fundRows.length} stocks ${stockIds.length} in ${Date.now() - started}ms`);
  }

  if (siteOnly) {
    console.log("site only: keeping saved fund and stock snapshots");
  }

  const stockRows: { stock_id: string; month: string; payload: unknown; updated_at: string }[] = [];
  for (const [id, list] of pendingStock) {
    const history = (stockHistory.get(id) || []).filter((h) => h.fund_count > 0);
    for (const item of list) {
      stockRows.push({
        stock_id: id,
        month: item.month,
        payload: { ...item.payload, history },
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (!siteOnly) await upsertChunks(db, "stock_snapshot", stockRows, "stock_id,month");

  const fundPatch: { family_id: number; month: string; payload: unknown; updated_at: string }[] = [];
  for (const month of siteOnly ? [] : months) {
    const data = await fetchAllRows<{ family_id: number; payload: object }>(
      () => db.from("fund_snapshot").select("family_id, payload").eq("month", month).order("family_id"),
      40,
    );
    for (const row of data) {
      const id = Number(row.family_id);
      const availableMonths = [...(familyMonths.get(id) || [])].sort((a, b) => b.localeCompare(a));
      fundPatch.push({
        family_id: id,
        month,
        payload: { ...(row.payload as object), availableMonths },
        updated_at: new Date().toISOString(),
      });
    }
  }
  await upsertChunks(db, "fund_snapshot", fundPatch, "family_id,month");

  const [fundDirectory, stockDirectory, freshness, overlapSuggestions, searchIndex] = await Promise.all([
    getFundDirectory(),
    getStockDirectory(),
    getDataFreshness(),
    loadOverlapSuggestions(),
    getSearchIndex(),
  ]);
  const latestChase = (await db.from("report_snapshot").select("payload").eq("month", months[0]).maybeSingle()).data
    ?.payload as { chase?: { stock_id: string; fund_count: number; net_value_delta_cr: number }[] } | undefined;
  const ids = topIds(fundDirectory, (latestChase?.chase || []) as Parameters<typeof topIds>[1]);
  const meta = siteMetaPayload({
    months: monthsAll,
    freshness,
    topFundIds: ids.topFundIds,
    topStockIds: ids.topStockIds,
    fundDirectory,
    stockDirectory,
    reportHeadlines: headlinesFromReports(reports.map((r) => ({ month: r.month, report: r.report }))),
    overlapSuggestions,
    searchIndex,
  });
  const { error: mErr } = await db.from("site_snapshot").upsert(
    { key: SITE_META_KEY, payload: meta, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (mErr) throw new Error(`site_snapshot: ${mErr.message}`);

  mkdirSync(resolve(process.cwd(), "public"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "public/search-index.json"), JSON.stringify(searchIndex));
  console.log(`wrote public/search-index.json (${searchIndex.funds.length} funds, ${searchIndex.stocks.length} stocks)`);
  await notifyRevalidate("holdings");
  console.log("snapshots ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

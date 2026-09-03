import { readFileSync } from "fs";
import { resolve } from "path";
import { rowFromFinapi, type SchemeMetric } from "../lib/scheme-metrics";
import { createServiceClient } from "../lib/supabase";
import { notifyRevalidate } from "../lib/notify-revalidate";

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

const BASE = (process.env.FINAPI_BASE || "https://finapi.upvaly.com").replace(/\/$/, "");
const KEY = process.env.FINAPI_API_KEY;
const PAGE_SIZE = Number(process.env.INGEST_METRICS_PAGE_SIZE || "50");
const MAX_PAGES = Number(process.env.INGEST_METRICS_MAX_PAGES || "0");
const CONCURRENCY = Math.max(1, Number(process.env.INGEST_METRICS_CONCURRENCY || "4"));
const FETCH_TIMEOUT_MS = Number(process.env.INGEST_METRICS_TIMEOUT_MS || "25000");
const DELAY_MS = Number(process.env.INGEST_METRICS_DELAY_MS || "80");
const START_PAGE = Math.max(1, Number(process.env.INGEST_METRICS_START_PAGE || "1"));
const FIELDS = [
  "schemeCode",
  "schemeName",
  "fundHouse",
  "companyName",
  "expenseRatio",
  "totalExpensesRatio",
  "cagr",
  "riskMetrics",
  "planName",
  "optionName",
  "schemeCategory",
  "schemeCategoryLabel",
  "aum",
  "fundamentals",
].join(",");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function finget(path: string): Promise<unknown> {
  const url = `${BASE}${path}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "X-API-Key": KEY! },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const text = await res.text();
      const transient =
        res.status === 429 ||
        res.status >= 500 ||
        (res.status === 400 && /EntityManager|RUNTIME_ERROR/i.test(text));
      if (transient) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        throw new Error(`FinAPI ${res.status}: ${text.slice(0, 200)}`);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`FinAPI invalid JSON: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/^FinAPI \d/.test(msg) && !/FinAPI 429|FinAPI 5/.test(msg)) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`FinAPI failed after retries: ${path}`);
}

function pagePath(page: number) {
  return `/api/mf/paginated?page=${page}&size=${PAGE_SIZE}&fields=${encodeURIComponent(FIELDS)}`;
}

async function main() {
  if (!KEY) {
    console.error("Set FINAPI_API_KEY in .env.local (do not commit it).");
    process.exit(1);
  }

  const db = createServiceClient();
  const started = new Date().toISOString();
  const { data: run, error: runErr } = await db
    .from("ingest_runs")
    .insert({
      source: "finapi-metrics",
      started_at: started,
      status: "running",
      months: [],
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  let seen = 0;
  let kept = 0;
  const batch: SchemeMetric[] = [];

  function errText(e: unknown): string {
    if (e instanceof Error && e.message && !e.message.startsWith("[object")) return e.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  async function flush() {
    if (!batch.length) return;
    const unique = [...new Map(batch.splice(0, batch.length).map((r) => [r.scheme_code, r])).values()];
    const { error } = await db.from("scheme_metrics").upsert(unique, { onConflict: "scheme_code" });
    if (error) throw new Error(errText(error));
  }

  function takePage(content: Record<string, unknown>[]) {
    for (const raw of content) {
      seen += 1;
      const row = rowFromFinapi(raw);
      if (!row) continue;
      if (!row.is_direct || !row.is_growth || !row.is_active_equity) continue;
      batch.push({ ...row, fetched_at: new Date().toISOString() });
      kept += 1;
    }
  }

  try {
    const first = (await finget(pagePath(1))) as {
      data?: { content?: Record<string, unknown>[]; pagination?: { totalPages?: number } };
    };
    let totalPages = Number(first.data?.pagination?.totalPages || 1);
    if (MAX_PAGES > 0) totalPages = Math.min(totalPages, MAX_PAGES);
    if (START_PAGE <= 1) {
      takePage(first.data?.content || []);
      await flush();
      console.log(`page 1/${totalPages} seen=${seen} active-direct-growth=${kept} concurrency=${CONCURRENCY}`);
    } else {
      console.log(`resume from page ${START_PAGE}/${totalPages} (skipping 1-${START_PAGE - 1})`);
    }

    const loopStart = START_PAGE <= 1 ? 2 : START_PAGE;
    for (let start = loopStart; start <= totalPages; start += CONCURRENCY) {
      const pages = [];
      for (let p = start; p < start + CONCURRENCY && p <= totalPages; p++) pages.push(p);
      const results = await Promise.all(
        pages.map(async (p) => {
          try {
            const json = (await finget(pagePath(p))) as {
              data?: { content?: Record<string, unknown>[] };
            };
            return { p, content: json.data?.content || [] };
          } catch (e) {
            console.error(`skip page ${p}: ${errText(e)}`);
            return { p, content: [] as Record<string, unknown>[] };
          }
        }),
      );
      results.sort((a, b) => a.p - b.p);
      for (const r of results) takePage(r.content);
      await flush();
      const last = pages[pages.length - 1];
      console.log(`pages ${pages[0]}-${last}/${totalPages} seen=${seen} active-direct-growth=${kept}`);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
    await flush();
    await db
      .from("ingest_runs")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        families_ok: kept,
        families_fail: 0,
        notes: `scanned ${seen} schemes; upserted ${kept} Direct Growth active-equity`,
      })
      .eq("id", run.id);
    console.log(`done. upserted ${kept} schemes (scanned ${seen}).`);
    await notifyRevalidate("metrics");
  } catch (e) {
    const msg = errText(e);
    await db
      .from("ingest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        families_ok: kept,
        families_fail: 1,
        notes: msg.slice(0, 2000),
      })
      .eq("id", run.id);
    console.error(msg);
    process.exit(1);
  }
}

main();

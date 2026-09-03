import { readFileSync } from "fs";
import { resolve } from "path";
import { normalizeNameKey, slugifyAmc } from "../lib/equity";
import { createServiceClient, fetchAllRows } from "../lib/supabase";
import type { HoldingEvent } from "../lib/types";

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
const LIMIT = Number(process.env.INGEST_HOLDINGS_LIMIT || "0");
const MONTHS = Math.min(24, Math.max(2, Number(process.env.INGEST_HOLDINGS_MONTHS || "12")));
const DELAY_MS = Number(process.env.INGEST_HOLDINGS_DELAY_MS || "250");
const FETCH_TIMEOUT_MS = Number(process.env.INGEST_HOLDINGS_TIMEOUT_MS || "60000");
const SKIP_EXISTING = process.env.INGEST_HOLDINGS_SKIP_EXISTING !== "0";
const AGG_ONLY = process.env.INGEST_HOLDINGS_AGG_ONLY === "1";
const CODE_FILTER = (process.env.INGEST_HOLDINGS_CODES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "" || v === "-") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function lastCompletedYyyyMm(): string {
  const d = new Date();
  // AMC books land ~10 working days after month-end. Before the 15th, last month is still incomplete.
  const shift = d.getDate() < 15 ? 2 : 1;
  d.setDate(1);
  d.setMonth(d.getMonth() - shift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthWindow(end: string, count: number): string[] {
  const out: string[] = [];
  let cur = end;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    cur = previousMonth(cur);
  }
  return out;
}

function toYyyyMm(raw: string): string {
  const s = raw.trim();
  const ymd = s.match(/^(\d{4})-(\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}`;
  const mmy = s.match(/^(\d{1,2})-(\d{4})$/);
  if (mmy) return `${mmy[2]}-${mmy[1].padStart(2, "0")}`;
  return s;
}

function toFinMonth(yyyyMm: string): string {
  const n = toYyyyMm(yyyyMm);
  const [y, m] = n.split("-");
  return `${m}-${y}`;
}

function inclusiveMonthCount(start: string, end: string): number {
  const [ys, ms] = toYyyyMm(start).split("-").map(Number);
  const [ye, me] = toYyyyMm(end).split("-").map(Number);
  return (ye - ys) * 12 + (me - ms) + 1;
}

/** FinAPI errors if a single request looks longer than 24 months; keep chunks well under that. */
function rangeChunks(monthsNewestFirst: string[], maxInclusive = 11): { start: string; end: string }[] {
  const oldestFirst = [...monthsNewestFirst].reverse();
  const chunks: { start: string; end: string }[] = [];
  for (let i = 0; i < oldestFirst.length; i += maxInclusive) {
    const slice = oldestFirst.slice(i, i + maxInclusive);
    chunks.push({ start: slice[0], end: slice[slice.length - 1] });
  }
  return chunks;
}

function fromFinAsOf(asOf: unknown): string | null {
  const s = String(asOf || "").trim();
  const mmyyyy = s.match(/^(\d{2})-(\d{4})$/);
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1]}`;
  const yyyymm = s.match(/^(\d{4})-(\d{2})/);
  if (yyyymm) return `${yyyymm[1]}-${yyyymm[2]}`;
  return null;
}

function classify(prevQty: number | undefined, qty: number): HoldingEvent {
  if (prevQty === undefined) return qty > 0 ? "new" : "hold";
  if (prevQty <= 0 && qty > 0) return "new";
  if (prevQty > 0 && qty <= 0) return "exit";
  if (qty > prevQty) return "add";
  if (qty < prevQty) return "cut";
  return "hold";
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mergeQtyValueWeight(
  a: { qty: number; value: number; weight: number },
  b: { qty: number; value: number; weight: number },
) {
  const qty = a.qty + b.qty;
  const value = a.value + b.value;
  const weight =
    value > 0 ? (a.weight * a.value + b.weight * b.value) / value : Math.max(a.weight, b.weight);
  return { qty, value, weight };
}

type SnapshotInsert = {
  family_id: number;
  month: string;
  stock_id: string;
  quantity: number;
  market_value_cr: number;
  weight_pct: number;
};

type DiffInsert = {
  family_id: number;
  month: string;
  stock_id: string;
  qty_delta: number;
  weight_delta: number;
  value_delta_cr: number;
  event: HoldingEvent;
};

function collapseSnapshots(rows: SnapshotInsert[]): SnapshotInsert[] {
  const map = new Map<string, SnapshotInsert>();
  for (const row of rows) {
    const key = `${row.family_id}|${row.month}|${row.stock_id}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row });
      continue;
    }
    const merged = mergeQtyValueWeight(
      { qty: prev.quantity, value: prev.market_value_cr, weight: prev.weight_pct },
      { qty: row.quantity, value: row.market_value_cr, weight: row.weight_pct },
    );
    map.set(key, {
      ...prev,
      quantity: merged.qty,
      market_value_cr: merged.value,
      weight_pct: merged.weight,
    });
  }
  return [...map.values()];
}

function collapseDiffs(rows: DiffInsert[]): DiffInsert[] {
  const map = new Map<string, DiffInsert>();
  for (const row of rows) {
    const key = `${row.family_id}|${row.month}|${row.stock_id}`;
    if (!map.has(key)) map.set(key, { ...row });
  }
  return [...map.values()];
}

function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function finget(path: string): Promise<unknown> {
  const url = `${BASE}${path}`;
  for (let attempt = 0; attempt < 6; attempt++) {
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
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        throw new Error(`FinAPI ${res.status}: ${text.slice(0, 200)}`);
      }
      return JSON.parse(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/^FinAPI \d/.test(msg) && !/FinAPI 429|FinAPI 5/.test(msg)) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`FinAPI failed after retries: ${path}`);
}

type StockRow = { id: string; name_key: string; sector: string };
type HoldingRow = {
  name?: string;
  isin?: string;
  sector?: string;
  quantity?: unknown;
  weightage?: unknown;
  marketValue?: unknown;
  category?: string;
};

async function main() {
  if (!KEY) {
    console.error("Set FINAPI_API_KEY in .env.local (do not commit it).");
    process.exit(1);
  }

  const db = createServiceClient();
  await db
    .from("ingest_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: "failed",
      notes: "Marked failed: superseded by a new ingest run",
    })
    .eq("status", "running");

  const end = toYyyyMm(process.env.INGEST_HOLDINGS_END_MONTH || lastCompletedYyyyMm());
  let months = monthWindow(end, MONTHS);
  while (months.length > 1 && inclusiveMonthCount(months[months.length - 1], months[0]) > 23) {
    months = months.slice(0, -1);
  }
  const start = months[months.length - 1];
  const chunks = rangeChunks(months, 1);

  const { data: run, error: runErr } = await db
    .from("ingest_runs")
    .insert({
      source: "finapi-holdings",
      status: "running",
      months,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  let familiesOk = 0;
  let familiesFail = 0;
  const notes: string[] = [
    `window=${toFinMonth(start)}..${toFinMonth(end)} ${CODE_FILTER.length ? `codes=${CODE_FILTER.join(",")}` : LIMIT > 0 ? `limit=${LIMIT}` : "all-schemes"} skip_existing=${SKIP_EXISTING}`,
  ];

  const stockCache = new Map<string, StockRow>();

  async function upsertStock(h: HoldingRow): Promise<string | null> {
    const display = (h.name || "").trim();
    if (!display) return null;
    const sector = (h.sector || "").trim();
    const name_key = normalizeNameKey(display);
    const cacheKey = `${name_key}|${sector}`;
    const cached = stockCache.get(cacheKey);
    if (cached) return cached.id;

    const isin = h.isin?.trim() || null;
    if (isin) {
      const existing = await db.from("stocks").select("id,name_key,sector").eq("isin", isin).maybeSingle();
      if (existing.data) {
        stockCache.set(cacheKey, existing.data as StockRow);
        return existing.data.id as string;
      }
    }

    const existingKey = await db
      .from("stocks")
      .select("id,name_key,sector")
      .eq("name_key", name_key)
      .eq("sector", sector)
      .maybeSingle();
    if (existingKey.data) {
      stockCache.set(cacheKey, existingKey.data as StockRow);
      return existingKey.data.id as string;
    }

    const inserted = await db
      .from("stocks")
      .insert({ isin, display_name: display, name_key, sector })
      .select("id,name_key,sector")
      .single();
    if (inserted.error) {
      const retry = await db
        .from("stocks")
        .select("id,name_key,sector")
        .eq("name_key", name_key)
        .eq("sector", sector)
        .maybeSingle();
      if (retry.data) {
        stockCache.set(cacheKey, retry.data as StockRow);
        return retry.data.id as string;
      }
      throw inserted.error;
    }
    stockCache.set(cacheKey, inserted.data as StockRow);
    return inserted.data.id as string;
  }

  try {
    const schemes: {
      scheme_code: string;
      name: string;
      fund_house: string;
      amc_slug: string;
      category: string;
      aum_cr: number | null;
    }[] = [];
    const page = 1000;
    if (!AGG_ONLY) {
    if (CODE_FILTER.length) {
      const { data, error: sErr } = await db
        .from("scheme_metrics")
        .select("scheme_code,name,fund_house,amc_slug,category,aum_cr")
        .eq("is_direct", true)
        .eq("is_growth", true)
        .eq("is_active_equity", true)
        .in("scheme_code", CODE_FILTER);
      if (sErr) throw sErr;
      schemes.push(...((data || []) as typeof schemes));
    } else {
      for (let from = 0; from < 20000; from += page) {
        const { data, error: sErr } = await db
          .from("scheme_metrics")
          .select("scheme_code,name,fund_house,amc_slug,category,aum_cr")
          .eq("is_direct", true)
          .eq("is_growth", true)
          .eq("is_active_equity", true)
          .order("aum_cr", { ascending: false })
          .range(from, from + page - 1);
        if (sErr) throw sErr;
        if (!data?.length) break;
        schemes.push(...(data as typeof schemes));
        if (data.length < page) break;
        if (LIMIT > 0 && schemes.length >= LIMIT) break;
      }
      if (LIMIT > 0 && schemes.length > LIMIT) schemes.length = LIMIT;
    }
    }
    if (!AGG_ONLY && !schemes?.length) {
      throw new Error("No scheme_metrics rows. Run npm run ingest:metrics first.");
    }

    if (AGG_ONLY) {
      notes.push("agg_only=1 (no FinAPI fetch)");
      console.log(`rebuild aggregates only, months ${start} → ${end}`);
    } else {
      notes.push(`schemes=${schemes.length}`);
      console.log(
        `holdings ingest ${schemes.length} funds, ${months.length} months ${start} → ${end} in ${chunks.length} FinAPI chunk(s)`,
      );
    }

    for (const scheme of AGG_ONLY ? [] : schemes) {
      const code = String(scheme.scheme_code);
      const familyId = Number(code);
      if (!Number.isFinite(familyId)) {
        familiesFail += 1;
        notes.push(`skip bad code ${code}`);
        continue;
      }

      try {
        if (SKIP_EXISTING && !CODE_FILTER.length) {
          const { count } = await db
            .from("holdings_snapshots")
            .select("stock_id", { count: "exact", head: true })
            .eq("family_id", familyId);
          if (count && count > 0) {
            familiesOk += 1;
            console.log(`skip existing ${code} ${scheme.name} snaps=${count}`);
            continue;
          }
        }

        const amcName = String(scheme.fund_house || "unknown");
        const slug = scheme.amc_slug || slugifyAmc(amcName) || "unknown";
        await db.from("amcs").upsert({ slug, name: amcName });
        await db.from("families").upsert({
          id: familyId,
          name: String(scheme.name),
          amc_slug: slug,
          sebi_category: String(scheme.category || ""),
          is_active_equity: true,
          has_holdings: true,
          latest_month: months[0],
        });

        const byMonth = new Map<string, HoldingRow[]>();
        for (const chunk of chunks) {
          const path = `/api/mf/holdings-history/scheme-code/${encodeURIComponent(code)}?startMonth=${toFinMonth(chunk.start)}&endMonth=${toFinMonth(chunk.end)}`;
          const json = (await finget(path)) as {
            data?: { holdingsHistory?: Record<string, unknown>[] };
          };
          const history = json.data?.holdingsHistory || [];
          for (const entry of history) {
            const month =
              fromFinAsOf(entry.holdingsAsOf) ||
              (entry.holdingsYear != null && entry.holdingsMonth != null
                ? `${entry.holdingsYear}-${String(entry.holdingsMonth).padStart(2, "0")}`
                : null);
            if (!month) continue;
            const list = (entry.holdings as HoldingRow[]) || [];
            byMonth.set(month, list);
          }
        }

        const snapshots: Record<string, Map<string, { qty: number; value: number; weight: number }>> = {};

        for (const month of months) {
          const equityRows = byMonth.get(month) || [];
          const map = new Map<string, { qty: number; value: number; weight: number }>();
          const rowsToInsert: {
            family_id: number;
            month: string;
            stock_id: string;
            quantity: number;
            market_value_cr: number;
            weight_pct: number;
          }[] = [];

          for (const h of equityRows) {
            const cat = (h.category || "").toLowerCase();
            if (cat && /debt|bond|money market|tbill|g-sec|commercial paper|certificate of deposit/.test(cat)) {
              continue;
            }
            const stockId = await upsertStock(h);
            if (!stockId) continue;
            const qty = parseNum(h.quantity);
            if (qty <= 0) continue;
            const valueLakhs = parseNum(h.marketValue);
            const value = valueLakhs / 100;
            const weight = parseNum(h.weightage);
            const incoming = { qty, value, weight };
            const prev = map.get(stockId);
            map.set(stockId, prev ? mergeQtyValueWeight(prev, incoming) : incoming);
            rowsToInsert.push({
              family_id: familyId,
              month,
              stock_id: stockId,
              quantity: qty,
              market_value_cr: value,
              weight_pct: weight,
            });
          }

          const uniqueRows = collapseSnapshots(rowsToInsert);
          if (uniqueRows.length) {
            const { error } = await db.from("holdings_snapshots").upsert(uniqueRows, {
              onConflict: "family_id,month,stock_id",
            });
            if (error) throw error;
          }
          snapshots[month] = map;
        }

        const latestWithBooks = months.find((m) => (snapshots[m]?.size || 0) > 0) || null;
        await db
          .from("families")
          .update({ has_holdings: Boolean(latestWithBooks), latest_month: latestWithBooks })
          .eq("id", familyId);

        const diffs: {
          family_id: number;
          month: string;
          stock_id: string;
          qty_delta: number;
          weight_delta: number;
          value_delta_cr: number;
          event: HoldingEvent;
        }[] = [];

        for (let i = 0; i < months.length - 1; i++) {
          const month = months[i];
          const prev = months[i + 1];
          const curMap = snapshots[month] || new Map();
          const prevMap = snapshots[prev] || new Map();
          // Missing disclosure ≠ mass exit. Skip diffs when this month has no book.
          if (!curMap.size) continue;
          const ids = new Set([...curMap.keys(), ...prevMap.keys()]);
          for (const stockId of ids) {
            const cur = curMap.get(stockId);
            const was = prevMap.get(stockId);
            const qty = cur?.qty ?? 0;
            const prevQty = was?.qty;
            diffs.push({
              family_id: familyId,
              month,
              stock_id: stockId,
              qty_delta: qty - (prevQty ?? 0),
              weight_delta: (cur?.weight ?? 0) - (was?.weight ?? 0),
              value_delta_cr: (cur?.value ?? 0) - (was?.value ?? 0),
              event: classify(prevQty, qty),
            });
          }
        }

        const uniqueDiffs = collapseDiffs(diffs);
        if (uniqueDiffs.length) {
          const { error } = await db.from("holding_diffs").upsert(uniqueDiffs, {
            onConflict: "family_id,month,stock_id",
          });
          if (error) throw error;
        }

        familiesOk += 1;
        console.log(`ok ${code} ${scheme.name} months=${byMonth.size}`);
      } catch (err) {
        familiesFail += 1;
        const msg = errText(err);
        notes.push(`fail ${code}: ${msg}`);
        console.error(`skip ${code}: ${msg}`);
      }
      await sleep(DELAY_MS);
    }

    for (const month of months.slice(0, -1)) {
      const prev = previousMonth(month);
      const { count: snapCount, error: cErr } = await db
        .from("holdings_snapshots")
        .select("stock_id", { count: "exact", head: true })
        .eq("month", month);
      if (cErr) throw cErr;
      if (!snapCount) {
        await db.from("holding_diffs").delete().eq("month", month);
        await db.from("stock_month_aggregates").delete().eq("month", month);
        notes.push(`skip empty month ${month} (no snapshots; not a mass exit)`);
        continue;
      }

      const diffs = await fetchAllRows<{ stock_id: string; qty_delta: number; value_delta_cr: number }>(() =>
        db.from("holding_diffs").select("stock_id, qty_delta, value_delta_cr").eq("month", month),
      );
      const snaps = await fetchAllRows<{ stock_id: string; weight_pct: number; family_id: number }>(() =>
        db.from("holdings_snapshots").select("stock_id, weight_pct, family_id").eq("month", month),
      );
      const prevSnaps = await fetchAllRows<{ stock_id: string; family_id: number }>(() =>
        db.from("holdings_snapshots").select("stock_id, family_id").eq("month", prev),
      );
      notes.push(`agg ${month} snaps=${snaps.length} diffs=${diffs.length}`);
      console.log(`agg ${month} snaps=${snaps.length} diffs=${diffs.length}`);

      const weights = new Map<string, number[]>();
      const fundCount = new Map<string, Set<number>>();
      for (const row of snaps || []) {
        const sid = row.stock_id as string;
        if (!weights.has(sid)) weights.set(sid, []);
        weights.get(sid)!.push(Number(row.weight_pct));
        if (!fundCount.has(sid)) fundCount.set(sid, new Set());
        fundCount.get(sid)!.add(row.family_id as number);
      }
      const prevCount = new Map<string, Set<number>>();
      for (const row of prevSnaps || []) {
        const sid = row.stock_id as string;
        if (!prevCount.has(sid)) prevCount.set(sid, new Set());
        prevCount.get(sid)!.add(row.family_id as number);
      }

      const netQty = new Map<string, number>();
      const netVal = new Map<string, number>();
      for (const row of diffs || []) {
        const sid = row.stock_id as string;
        netQty.set(sid, (netQty.get(sid) || 0) + Number(row.qty_delta));
        netVal.set(sid, (netVal.get(sid) || 0) + Number(row.value_delta_cr));
      }

      const stockIds = new Set([...fundCount.keys(), ...netQty.keys()]);
      const agg = [...stockIds].map((stock_id) => {
        const fc = fundCount.get(stock_id)?.size ?? 0;
        const pc = prevCount.get(stock_id)?.size ?? 0;
        return {
          stock_id,
          month,
          fund_count: fc,
          fund_count_delta: fc - pc,
          net_qty_delta: netQty.get(stock_id) || 0,
          net_value_delta_cr: netVal.get(stock_id) || 0,
          median_weight_pct: median(weights.get(stock_id) || []),
        };
      });

      if (agg.length) {
        for (let i = 0; i < agg.length; i += 500) {
          const { error } = await db.from("stock_month_aggregates").upsert(agg.slice(i, i + 500));
          if (error) throw error;
        }
      }
    }

    const status = AGG_ONLY
      ? "ok"
      : familiesFail && familiesOk
        ? "partial"
        : familiesOk
          ? "ok"
          : "failed";
    await db
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        months,
        families_ok: familiesOk,
        families_fail: familiesFail,
        notes: notes.join("\n").slice(0, 8000),
      })
      .eq("id", run.id);
    console.log(`done status=${status} ok=${familiesOk} fail=${familiesFail}`);
  } catch (err) {
    await db
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        months,
        families_ok: familiesOk,
        families_fail: familiesFail,
        notes: `${notes.join("\n")}\n${errText(err)}`.slice(0, 8000),
      })
      .eq("id", run.id);
    console.error(errText(err));
    process.exit(1);
  }
}

main();

/**
 * Load one EJI API monthly holdings file into active-equity books.
 * The gzip stays in data/holdings/ and is not committed. Download a month at most
 * a few times; the licence allows 10.
 *
 *   INGEST_HOLDINGS_BULK_FILE=data/holdings/holdings-2026-10.jsonl.gz \
 *   INGEST_HOLDINGS_BULK_MONTH=2026-10 \
 *   tsx scripts/ingest-bulk-holdings.ts
 */
import { createReadStream, readFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { normalizeNameKey, slugifyAmc } from "../lib/equity";
import { canonicalizeSector } from "../lib/format";
import { effectiveIsin } from "../lib/instruments";
import { notifyRevalidate } from "../lib/notify-revalidate";
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

const FILE = process.env.INGEST_HOLDINGS_BULK_FILE || "data/holdings/holdings-2026-10.jsonl.gz";
const MONTH = process.env.INGEST_HOLDINGS_BULK_MONTH || "2026-10";

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const PREV = previousMonth(MONTH);

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "" || v === "-") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
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
  const weight = value > 0 ? (a.weight * a.value + b.weight * b.value) / value : Math.max(a.weight, b.weight);
  return { qty, value, weight };
}

type Scheme = {
  scheme_code: string;
  name: string;
  fund_house: string;
  amc_slug: string;
  category: string;
};

type Holding = {
  name?: string;
  displayName?: string;
  isin?: string;
  sector?: string;
  assetType?: string;
  quantity?: unknown;
  weightage?: unknown;
  marketValue?: unknown;
};

type Pos = { qty: number; value: number; weight: number };

type StockRow = { id: string; name_key: string; sector: string };

const KEEP_ASSET = new Set(["equity", "foreign"]);

function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function main() {
  const db = createServiceClient();
  const notes: string[] = [`bulk file=${FILE} month=${MONTH} prev=${PREV}`];

  const { data: run, error: runErr } = await db
    .from("ingest_runs")
    .insert({ source: "ejiapi-bulk-holdings", status: "running", months: [MONTH, PREV] })
    .select("id")
    .single();
  if (runErr) throw runErr;

  let familiesOk = 0;
  let familiesFail = 0;
  let familiesMiss = 0;

  try {
    const schemes = await fetchAllRows<Scheme>(() =>
      db
        .from("scheme_metrics")
        .select("scheme_code,name,fund_house,amc_slug,category")
        .eq("is_direct", true)
        .eq("is_growth", true)
        .eq("is_active_equity", true)
        .order("scheme_code"),
    );
    const byCode = new Map(schemes.map((s) => [String(s.scheme_code), s]));
    console.log(`active-equity schemes ${schemes.length}`);

    const stockCache = new Map<string, StockRow>();

    async function rememberStock(row: StockRow, keys: string[]) {
      for (const k of keys) stockCache.set(k, row);
      return row.id;
    }

    async function alignSector(id: string, current: string, sector: string) {
      if (current === sector) return sector;
      const { error } = await db.from("stocks").update({ sector }).eq("id", id);
      if (error) return current;
      return sector;
    }

    async function upsertStock(h: Holding): Promise<string | null> {
      const display = (h.displayName || h.name || "").trim();
      if (!display) return null;
      const sector = canonicalizeSector(h.sector || "");
      const name_key = normalizeNameKey(display);
      const isin = effectiveIsin(h.isin);
      const cacheKeys = [`${name_key}|${sector}`, ...(isin ? [`isin:${isin}`] : [])];
      const cached = cacheKeys.map((k) => stockCache.get(k)).find(Boolean);
      if (cached) {
        if (sector) {
          const next = await alignSector(cached.id, cached.sector, sector);
          cached.sector = next;
        }
        return rememberStock(cached, cacheKeys);
      }
      if (isin) {
        const existing = await db.from("stocks").select("id,name_key,sector").eq("isin", isin).maybeSingle();
        if (existing.data) {
          const current = String(existing.data.sector || "");
          const next = sector ? await alignSector(existing.data.id as string, current, sector) : current;
          return rememberStock({ id: existing.data.id as string, name_key, sector: next }, cacheKeys);
        }
      }
      const existingKey = await db
        .from("stocks")
        .select("id,name_key,sector")
        .eq("name_key", name_key)
        .eq("sector", sector)
        .maybeSingle();
      if (existingKey.data) return rememberStock(existingKey.data as StockRow, cacheKeys);

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
        if (retry.data) return rememberStock(retry.data as StockRow, cacheKeys);
        throw inserted.error;
      }
      return rememberStock(inserted.data as StockRow, cacheKeys);
    }

    async function loadPositions(familyId: number, month: string) {
      const rows = await fetchAllRows<{
        stock_id: string;
        quantity: number;
        market_value_cr: number;
        weight_pct: number;
      }>(() =>
        db
          .from("holdings_snapshots")
          .select("stock_id, quantity, market_value_cr, weight_pct")
          .eq("family_id", familyId)
          .eq("month", month)
          .order("stock_id"),
      );
      const map = new Map<string, Pos>();
      for (const row of rows) {
        map.set(row.stock_id, {
          qty: Number(row.quantity) || 0,
          value: Number(row.market_value_cr) || 0,
          weight: Number(row.weight_pct) || 0,
        });
      }
      return map;
    }

    async function pruneStale(table: "holdings_snapshots" | "holding_diffs", familyId: number, keep: string[]) {
      const data = await fetchAllRows<{ stock_id: string }>(() =>
        db.from(table).select("stock_id").eq("family_id", familyId).eq("month", MONTH).order("stock_id"),
      );
      const keepSet = new Set(keep);
      const stale = data.map((r) => r.stock_id).filter((id) => !keepSet.has(id));
      for (let i = 0; i < stale.length; i += 200) {
        const { error } = await db
          .from(table)
          .delete()
          .eq("family_id", familyId)
          .eq("month", MONTH)
          .in("stock_id", stale.slice(i, i + 200));
        if (error) throw error;
      }
    }

    const seenFamilies = new Set<number>();
    const rl = readline.createInterface({
      input: createReadStream(resolve(FILE)).pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    let lineNo = 0;
    for await (const line of rl) {
      lineNo += 1;
      if (!line.trim()) continue;
      const row = JSON.parse(line) as Record<string, unknown>;
      if (lineNo === 1) {
        const coverage = row.coverage as { missingAmcs?: { amc: string; reason: string }[] } | undefined;
        const missing = (coverage?.missingAmcs || []).map((m) => `${m.amc} (${m.reason})`);
        notes.push(`file month=${row.month} version=${row.version} status=${row.status} funds=${row.funds}`);
        if (missing.length) notes.push(`missing: ${missing.join("; ")}`);
        if (String(row.month) !== MONTH) throw new Error(`file month ${row.month} is not ${MONTH}`);
        console.log(`file ${row.month} v${row.version} ${row.status} funds=${row.funds} missing=${missing.length}`);
        continue;
      }

      const asOf = String(row.holdingsAsOf || "");
      if (!asOf.startsWith(MONTH)) continue;
      const codes = ((row.schemeCodes as unknown[]) || []).map((c) => String(c));
      const matches = [...new Map(codes.filter((c) => byCode.has(c)).map((c) => [c, byCode.get(c)!])).values()];
      if (!matches.length) continue;

      for (const scheme of matches) {
        const familyId = Number(scheme.scheme_code);
        if (!Number.isFinite(familyId) || seenFamilies.has(familyId)) continue;
        seenFamilies.add(familyId);
        try {
          const amcName = String(scheme.fund_house || row.amc || "unknown");
          const slug = scheme.amc_slug || slugifyAmc(amcName) || "unknown";
          await db.from("amcs").upsert({ slug, name: amcName });
          await db.from("families").upsert({
            id: familyId,
            name: String(scheme.name || row.fund || ""),
            amc_slug: slug,
            sebi_category: String(scheme.category || ""),
            is_active_equity: true,
            has_holdings: true,
            latest_month: MONTH,
          });

          const map = new Map<string, Pos>();
          const rowsToInsert: {
            family_id: number;
            month: string;
            stock_id: string;
            quantity: number;
            market_value_cr: number;
            weight_pct: number;
          }[] = [];

          for (const h of (row.holdings as Holding[]) || []) {
            const asset = (h.assetType || "").toLowerCase();
            if (asset && !KEEP_ASSET.has(asset)) continue;
            const stockId = await upsertStock(h);
            if (!stockId) continue;
            const qty = parseNum(h.quantity);
            if (qty <= 0) continue;
            const value = parseNum(h.marketValue) / 100;
            const weight = parseNum(h.weightage);
            const incoming = { qty, value, weight };
            const prev = map.get(stockId);
            map.set(stockId, prev ? mergeQtyValueWeight(prev, incoming) : incoming);
          }

          for (const [stockId, pos] of map) {
            rowsToInsert.push({
              family_id: familyId,
              month: MONTH,
              stock_id: stockId,
              quantity: pos.qty,
              market_value_cr: pos.value,
              weight_pct: pos.weight,
            });
          }

          if (!rowsToInsert.length) {
            familiesMiss += 1;
            console.log(`empty ${scheme.scheme_code} ${scheme.name}`);
            continue;
          }

          for (let i = 0; i < rowsToInsert.length; i += 200) {
            const { error } = await db.from("holdings_snapshots").upsert(rowsToInsert.slice(i, i + 200), {
              onConflict: "family_id,month,stock_id",
            });
            if (error) throw error;
          }
          await pruneStale(
            "holdings_snapshots",
            familyId,
            rowsToInsert.map((r) => r.stock_id),
          );

          const prevMap = await loadPositions(familyId, PREV);
          const diffs: {
            family_id: number;
            month: string;
            stock_id: string;
            qty_delta: number;
            weight_delta: number;
            value_delta_cr: number;
            event: HoldingEvent;
          }[] = [];
          const ids = new Set([...map.keys(), ...prevMap.keys()]);
          for (const stockId of ids) {
            const cur = map.get(stockId);
            const was = prevMap.get(stockId);
            const qty = cur?.qty ?? 0;
            diffs.push({
              family_id: familyId,
              month: MONTH,
              stock_id: stockId,
              qty_delta: qty - (was?.qty ?? 0),
              weight_delta: (cur?.weight ?? 0) - (was?.weight ?? 0),
              value_delta_cr: (cur?.value ?? 0) - (was?.value ?? 0),
              event: classify(was ? was.qty : undefined, qty),
            });
          }
          if (diffs.length) {
            for (let i = 0; i < diffs.length; i += 200) {
              const { error } = await db.from("holding_diffs").upsert(diffs.slice(i, i + 200), {
                onConflict: "family_id,month,stock_id",
              });
              if (error) throw error;
            }
            await pruneStale(
              "holding_diffs",
              familyId,
              diffs.map((d) => d.stock_id),
            );
          }

          familiesOk += 1;
          if (familiesOk % 25 === 0) console.log(`ok ${familiesOk} ${scheme.scheme_code} ${scheme.name} lines=${rowsToInsert.length}`);
        } catch (err) {
          familiesFail += 1;
          const msg = errText(err);
          notes.push(`fail ${scheme.scheme_code}: ${msg}`);
          console.error(`skip ${scheme.scheme_code}: ${msg}`);
        }
      }
    }

    const snaps = await fetchAllRows<{ stock_id: string; weight_pct: number; family_id: number }>(() =>
      db
        .from("holdings_snapshots")
        .select("stock_id, weight_pct, family_id")
        .eq("month", MONTH)
        .order("family_id")
        .order("stock_id"),
    );
    const prevSnaps = await fetchAllRows<{ stock_id: string; family_id: number }>(() =>
      db
        .from("holdings_snapshots")
        .select("stock_id, family_id")
        .eq("month", PREV)
        .order("family_id")
        .order("stock_id"),
    );
    const diffRows = await fetchAllRows<{ stock_id: string; qty_delta: number; value_delta_cr: number }>(() =>
      db
        .from("holding_diffs")
        .select("stock_id, qty_delta, value_delta_cr")
        .eq("month", MONTH)
        .order("family_id")
        .order("stock_id"),
    );
    notes.push(`agg ${MONTH} snaps=${snaps.length} diffs=${diffRows.length} families=${familiesOk}`);
    console.log(`agg ${MONTH} snaps=${snaps.length} diffs=${diffRows.length}`);

    const weights = new Map<string, number[]>();
    const fundCount = new Map<string, Set<number>>();
    for (const row of snaps) {
      const sid = row.stock_id;
      if (!weights.has(sid)) weights.set(sid, []);
      weights.get(sid)!.push(Number(row.weight_pct));
      if (!fundCount.has(sid)) fundCount.set(sid, new Set());
      fundCount.get(sid)!.add(row.family_id);
    }
    const prevCount = new Map<string, Set<number>>();
    for (const row of prevSnaps) {
      const sid = row.stock_id;
      if (!prevCount.has(sid)) prevCount.set(sid, new Set());
      prevCount.get(sid)!.add(row.family_id);
    }
    const netQty = new Map<string, number>();
    const netVal = new Map<string, number>();
    for (const row of diffRows) {
      const sid = row.stock_id;
      netQty.set(sid, (netQty.get(sid) || 0) + Number(row.qty_delta));
      netVal.set(sid, (netVal.get(sid) || 0) + Number(row.value_delta_cr));
    }
    const stockIds = new Set([...fundCount.keys(), ...netQty.keys()]);
    const agg = [...stockIds].map((stock_id) => {
      const fc = fundCount.get(stock_id)?.size ?? 0;
      const pc = prevCount.get(stock_id)?.size ?? 0;
      return {
        stock_id,
        month: MONTH,
        fund_count: fc,
        fund_count_delta: fc - pc,
        net_qty_delta: netQty.get(stock_id) || 0,
        net_value_delta_cr: netVal.get(stock_id) || 0,
        median_weight_pct: median(weights.get(stock_id) || []),
      };
    });

    const { error: delErr } = await db.from("stock_month_aggregates").delete().eq("month", MONTH);
    if (delErr) throw delErr;
    for (let i = 0; i < agg.length; i += 500) {
      const { error } = await db.from("stock_month_aggregates").upsert(agg.slice(i, i + 500));
      if (error) throw error;
    }

    const status = familiesFail && familiesOk ? "partial" : familiesOk ? "ok" : "failed";
    notes.push(`done ok=${familiesOk} fail=${familiesFail} empty=${familiesMiss}`);
    await db
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        months: [MONTH, PREV],
        families_ok: familiesOk,
        families_fail: familiesFail,
        notes: notes.join("\n").slice(0, 8000),
      })
      .eq("id", run.id);
    console.log(`done status=${status} ok=${familiesOk} fail=${familiesFail} empty=${familiesMiss}`);
    if (status === "failed") process.exit(1);
    if (process.env.INGEST_SKIP_REVALIDATE !== "1") await notifyRevalidate("holdings");
  } catch (err) {
    await db
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        months: [MONTH, PREV],
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

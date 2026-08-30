import { readFileSync } from "fs";
import { resolve } from "path";
import { isActiveEquityCategory, normalizeNameKey, slugifyAmc } from "../lib/equity";
import { createServiceClient } from "../lib/supabase";
import type { HoldingEvent, MfdataFamily, MfdataHolding } from "../lib/types";

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

const MFDATA_BASE = process.env.MFDATA_BASE || "https://mfdata.in";
const MIN_AUM = Number(process.env.INGEST_MIN_AUM_CR || "0");
const MAX_FAMILIES = Number(process.env.INGEST_MAX_FAMILIES || "80");
const MONTHS = Number(process.env.INGEST_MONTHS || "3");
const DELAY_MS = Number(process.env.INGEST_DELAY_MS || "2200");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mfget<T>(path: string): Promise<T> {
  const url = `${MFDATA_BASE}${path}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 429) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
  throw new Error(`Rate limited: ${path}`);
}

function familyId(f: MfdataFamily): number | null {
  const id = f.id ?? f.family_id;
  return typeof id === "number" ? id : id != null ? Number(id) : null;
}

function familyName(f: MfdataFamily): string {
  return f.name || f.scheme_name || `family-${familyId(f)}`;
}

function familyCategory(f: MfdataFamily): string {
  return f.category || f.sebi_category || "";
}

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(latest: string, count: number): string[] {
  const out: string[] = [];
  let cur = latest;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    cur = previousMonth(cur);
  }
  return out;
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

type StockRow = { id: string; name_key: string; sector: string };

async function main() {
  const db = createServiceClient();
  const runInsert = await db
    .from("ingest_runs")
    .insert({ source: "mfdata", status: "running" })
    .select("id")
    .single();
  if (runInsert.error) throw runInsert.error;
  const runId = runInsert.data.id as string;

  let familiesOk = 0;
  let familiesFail = 0;
  const notes: string[] = [];
  let months: string[] = [];

  try {
    const stats = await mfget<{ data?: { latest_holdings_date?: string } }>("/api/v1/stats");
    const latest =
      stats.data?.latest_holdings_date ||
      (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();
    months = lastMonths(latest, MONTHS);

    const families: MfdataFamily[] = [];
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const page = await mfget<{ data?: MfdataFamily[]; count?: number }>(
        `/api/v1/families?has_holdings=true&limit=${pageSize}&offset=${offset}`
      );
      const rows = page.data || [];
      families.push(...rows);
      offset += rows.length;
      if (rows.length < pageSize) break;
      if (families.length > 8000) break;
      await sleep(DELAY_MS);
    }

    const equity = families
      .filter((f) => isActiveEquityCategory(familyCategory(f)))
      .filter((f) => (MIN_AUM <= 0 ? true : Number(f.aum_cr || 0) >= MIN_AUM))
      .sort((a, b) => Number(b.aum_cr || 0) - Number(a.aum_cr || 0))
      .slice(0, MAX_FAMILIES);

    notes.push(`latest_holdings=${latest}; families_raw=${families.length}; ingesting=${equity.length}`);

    const stockCache = new Map<string, StockRow>();

    async function upsertStock(h: MfdataHolding): Promise<string | null> {
      const display = (h.name || h.stock_name || "").trim();
      if (!display) return null;
      const sector = h.sector?.trim() || "";
      const name_key = normalizeNameKey(display);
      const cacheKey = `${name_key}|${sector || ""}`;
      const cached = stockCache.get(cacheKey);
      if (cached) return cached.id;

      const isin = h.isin?.trim() || null;
      if (isin) {
        const existing = await db.from("stocks").select("id,name_key,sector").eq("isin", isin).maybeSingle();
        if (existing.data) {
          stockCache.set(cacheKey, existing.data as StockRow);
          return existing.data.id;
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
        return existingKey.data.id;
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
          return retry.data.id;
        }
        throw inserted.error;
      }
      stockCache.set(cacheKey, inserted.data as StockRow);
      return inserted.data.id;
    }

    for (const f of equity) {
      const id = familyId(f);
      if (id == null) continue;
      try {
        const amcName = f.amc || f.amc_name || "unknown";
        const slug = slugifyAmc(amcName) || "unknown";
        await db.from("amcs").upsert({ slug, name: amcName });
        await db.from("families").upsert({
          id,
          name: familyName(f),
          amc_slug: slug,
          sebi_category: familyCategory(f),
          is_active_equity: true,
          has_holdings: true,
          latest_month: months[0],
        });

        const snapshots: Record<string, Map<string, { qty: number; value: number; weight: number }>> = {};

        for (const month of months) {
          await sleep(DELAY_MS);
          const payload = await mfget<{
            data?: { equity?: MfdataHolding[] } | MfdataHolding[];
          }>(`/api/v1/families/${id}/holdings?month=${month}&holding_type=equity`);

          const equityRows: MfdataHolding[] = Array.isArray(payload.data)
            ? payload.data
            : payload.data?.equity || [];

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
            const stockId = await upsertStock(h);
            if (!stockId) continue;
            const qty = Number(h.quantity || 0);
            const value = Number(h.market_value_cr || 0);
            const weight = Number(h.weight_pct || 0);
            map.set(stockId, { qty, value, weight });
            rowsToInsert.push({
              family_id: id,
              month,
              stock_id: stockId,
              quantity: qty,
              market_value_cr: value,
              weight_pct: weight,
            });
          }

          if (rowsToInsert.length) {
            const { error } = await db.from("holdings_snapshots").upsert(rowsToInsert);
            if (error) throw error;
          }
          snapshots[month] = map;
        }

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
          const ids = new Set([...curMap.keys(), ...prevMap.keys()]);
          for (const stockId of ids) {
            const cur = curMap.get(stockId);
            const was = prevMap.get(stockId);
            const qty = cur?.qty ?? 0;
            const prevQty = was?.qty;
            const event = classify(prevQty, qty);
            diffs.push({
              family_id: id,
              month,
              stock_id: stockId,
              qty_delta: qty - (prevQty ?? 0),
              weight_delta: (cur?.weight ?? 0) - (was?.weight ?? 0),
              value_delta_cr: (cur?.value ?? 0) - (was?.value ?? 0),
              event,
            });
          }
        }

        if (diffs.length) {
          const { error } = await db.from("holding_diffs").upsert(diffs);
          if (error) throw error;
        }

        familiesOk += 1;
        process.stdout.write(`ok ${id} ${familyName(f)}\n`);
      } catch (err) {
        familiesFail += 1;
        notes.push(`fail ${id}: ${(err as Error).message}`);
        process.stderr.write(`fail ${id}: ${(err as Error).message}\n`);
      }
    }

    for (const month of months.slice(0, -1)) {
      const prev = previousMonth(month);
      const { data: diffs, error: dErr } = await db
        .from("holding_diffs")
        .select("stock_id, qty_delta, value_delta_cr")
        .eq("month", month);
      if (dErr) throw dErr;

      const { data: snaps, error: sErr } = await db
        .from("holdings_snapshots")
        .select("stock_id, weight_pct, family_id")
        .eq("month", month);
      if (sErr) throw sErr;

      const { data: prevSnaps, error: pErr } = await db
        .from("holdings_snapshots")
        .select("stock_id, family_id")
        .eq("month", prev);
      if (pErr) throw pErr;

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
        const { error } = await db.from("stock_month_aggregates").upsert(agg);
        if (error) throw error;
      }
    }

    const status = familiesFail && familiesOk ? "partial" : familiesOk ? "ok" : "failed";
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
      .eq("id", runId);

    process.stdout.write(`done status=${status} ok=${familiesOk} fail=${familiesFail}\n`);
  } catch (err) {
    await db
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        months,
        families_ok: familiesOk,
        families_fail: familiesFail,
        notes: `${notes.join("\n")}\n${(err as Error).message}`.slice(0, 8000),
      })
      .eq("id", runId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

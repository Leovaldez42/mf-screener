import { cleanChaseRows } from "@/lib/chase-clean";
import { getChaseRows, getStockPayload } from "@/lib/cached-holdings";
import { sectorLabel } from "@/lib/format";
import { shortenFundName } from "@/lib/fund-name";
import { listCompleteMonths } from "@/lib/holdings-month";
import { isYearMonth } from "@/lib/site";
import type { ChaseRow } from "@/lib/types";

export type OgMove = { name: string; qty_delta: number };

export type OgStockCard = {
  month: string;
  name: string;
  sector: string;
  fund_count: number;
  fund_count_delta: number;
  net_value_delta_cr: number;
  cuts: OgMove[];
  adds: OgMove[];
};

export type OgMonthCard = {
  month: string;
  inflows: ChaseRow[];
  outflows: ChaseRow[];
  sector: { name: string; value: number } | null;
};

function byAbsQty(a: { qty_delta: number }, b: { qty_delta: number }) {
  return Math.abs(b.qty_delta) - Math.abs(a.qty_delta);
}

export async function loadOgStockCard(id: string, requestedMonth: string): Promise<OgStockCard | null> {
  const payload = await getStockPayload(id, requestedMonth);
  if ("error" in payload && payload.error) return null;
  const month = payload.month;
  if (!month) return null;
  const stock = payload.stock as { display_name?: string; sector?: string | null };
  const chase = (await getChaseRows(month)).find((r) => r.stock_id === id);
  const holders = (payload.holders || []) as {
    family_name: string;
    qty_delta: number;
    event: string;
  }[];
  const cuts = holders
    .filter((h) => h.event === "exit" || h.event === "cut")
    .sort(byAbsQty)
    .slice(0, 3)
    .map((h) => ({ name: shortenFundName(h.family_name), qty_delta: h.qty_delta }));
  const adds = holders
    .filter((h) => h.event === "new" || h.event === "add")
    .sort(byAbsQty)
    .slice(0, 3)
    .map((h) => ({ name: shortenFundName(h.family_name), qty_delta: h.qty_delta }));
  const summary = payload.summary as
    | {
        fund_count: number;
        fund_count_delta: number;
        net_value_delta_cr: number;
      }
    | undefined;
  return {
    month,
    name: String(stock?.display_name || "Unknown"),
    sector: sectorLabel(stock?.sector ?? chase?.sector),
    fund_count: chase?.fund_count ?? summary?.fund_count ?? 0,
    fund_count_delta: chase?.fund_count_delta ?? summary?.fund_count_delta ?? 0,
    net_value_delta_cr: chase?.net_value_delta_cr ?? summary?.net_value_delta_cr ?? 0,
    cuts,
    adds,
  };
}

export async function loadOgMonthCard(requestedMonth: string): Promise<OgMonthCard | null> {
  if (!isYearMonth(requestedMonth)) return null;
  const complete = await listCompleteMonths();
  if (!complete.includes(requestedMonth)) return null;
  const month = requestedMonth;
  const cleaned = cleanChaseRows(await getChaseRows(month));
  const inflows = [...cleaned]
    .filter((r) => r.net_value_delta_cr > 0)
    .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr)
    .slice(0, 3);
  const outflows = [...cleaned]
    .filter((r) => r.net_value_delta_cr < 0)
    .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr)
    .slice(0, 3);
  const sectorTotals = new Map<string, number>();
  for (const r of cleaned) {
    const key = sectorLabel(r.sector);
    if (key === "Unknown") continue;
    sectorTotals.set(key, (sectorTotals.get(key) ?? 0) + r.net_value_delta_cr);
  }
  const leading = [...sectorTotals.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  return {
    month,
    inflows,
    outflows,
    sector: leading ? { name: leading[0], value: leading[1] } : null,
  };
}


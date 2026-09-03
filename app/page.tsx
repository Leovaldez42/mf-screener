"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Delta, LoadingWait, loadWatchlist, saveWatchlist } from "@/components/ui";
import { formatMonthSpan, formatNumber } from "@/lib/format";
import type { ChaseRow } from "@/lib/types";

type SortKey = "display_name" | "sector" | "fund_count" | "net_qty_delta" | "net_value_delta_cr" | "median_weight_pct";

const COLUMNS: { key: SortKey; label: string; hide: string; sticky?: boolean }[] = [
  { key: "display_name", label: "Stock", hide: "", sticky: true },
  { key: "sector", label: "Sector", hide: "hidden sm:table-cell" },
  { key: "fund_count", label: "Funds", hide: "" },
  { key: "net_qty_delta", label: "Net qty", hide: "hidden md:table-cell" },
  { key: "net_value_delta_cr", label: "Net ₹ cr", hide: "" },
  { key: "median_weight_pct", label: "Median wt %", hide: "hidden sm:table-cell" },
];

function sortValue(row: ChaseRow, key: SortKey): string | number {
  if (key === "display_name") return row.display_name.toLowerCase();
  if (key === "sector") return (row.sector || "").toLowerCase();
  if (key === "median_weight_pct") return row.median_weight_pct ?? Number.NEGATIVE_INFINITY;
  return row[key];
}

export default function ChasePage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<ChaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [minFunds, setMinFunds] = useState("0");
  const [watch, setWatch] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("net_value_delta_cr");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => setWatch(loadWatchlist()), []);
  useEffect(() => {
    fetch("/api/v1/months", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMonths(d.months || []))
      .catch(() => setMonths([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    if (month) q.set("month", month);
    if (sector) q.set("sector", sector);
    if (minFunds !== "0") q.set("min_funds", minFunds);
    setLoading(true);
    fetch(`/api/v1/chase?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok && r.status !== 503) setError(d.error || "Failed to load");
        else setError(null);
        setRows(d.rows || []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, sector, minFunds]);

  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter(Boolean))] as string[],
    [rows]
  );

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "en-IN");
      else cmp = Number(av) - Number(bv);
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return next;
  }, [rows, sortKey, sortOrder]);

  const summary = useMemo(() => {
    const biggestInflows = [...rows]
      .filter((r) => r.net_value_delta_cr > 0)
      .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr);

    const biggestOutflows = [...rows]
      .filter((r) => r.net_value_delta_cr < 0)
      .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr);

    const sectorTotals = new Map<string, number>();
    rows.forEach((r) => {
      const key = r.sector || "Unassigned";
      sectorTotals.set(key, (sectorTotals.get(key) ?? 0) + r.net_value_delta_cr);
    });

    const leadingSector = [...sectorTotals.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

    return {
      inflow: biggestInflows[0] ?? null,
      outflow: biggestOutflows[0] ?? null,
      leadingSector: leadingSector ? { name: leadingSector[0], value: leadingSector[1] } : null,
    };
  }, [rows]);

  function toggle(id: string) {
    const next = watch.includes(id) ? watch.filter((x) => x !== id) : [...watch, id];
    setWatch(next);
    saveWatchlist(next);
  }

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "display_name" || key === "sector" ? "asc" : "desc");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Chase</h1>
        <p className="mt-1 text-sm text-muted">
          Active equity funds only. Adds and cuts use share quantity, not weight. Use{" "}
          <strong>Holdings as of</strong> in the header for {formatMonthSpan(months)}
          {months.length ? " (older months may have thinner coverage)" : ""}. Books lag month-end by
          about ten working days. Click a column header to sort.
        </p>
      </div>
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      {!loading && rows.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">Biggest inflow</div>
            <div className="mt-2 text-base font-medium text-foreground">
              {summary.inflow ? summary.inflow.display_name : "—"}
            </div>
            <div className="mt-1 text-sm text-gain">
              {summary.inflow ? `+${formatNumber(summary.inflow.net_value_delta_cr, 1)} ₹ cr` : "No positive movers"}
            </div>
          </div>

          <div className="rounded border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">Biggest outflow</div>
            <div className="mt-2 text-base font-medium text-foreground">
              {summary.outflow ? summary.outflow.display_name : "—"}
            </div>
            <div className="mt-1 text-sm text-loss">
              {summary.outflow ? `${formatNumber(summary.outflow.net_value_delta_cr, 1)} ₹ cr` : "No negative movers"}
            </div>
          </div>

          <div className="rounded border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">Sector signal</div>
            <div className="mt-2 text-base font-medium text-foreground">
              {summary.leadingSector ? summary.leadingSector.name : "—"}
            </div>
            <div className="mt-1 text-sm text-muted">
              {summary.leadingSector
                ? `${summary.leadingSector.value > 0 ? "Net inflow" : "Net outflow"}: ${formatNumber(Math.abs(summary.leadingSector.value), 1)} ₹ cr`
                : "No sector signal"}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Sector
          <select
            className="rounded border border-border bg-input px-2 py-1"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="">All</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Min funds
          <input
            className="w-20 rounded border border-border bg-input px-2 py-1"
            value={minFunds}
            onChange={(e) => setMinFunds(e.target.value)}
          />
        </label>
      </div>
      {loading ? (
        <LoadingWait label="Loading holdings…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint">
          No rows. Apply the SQL migration in Supabase, set <code>.env.local</code>, then run{" "}
          <code>npm run ingest</code>.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-faint">
              <tr>
                {COLUMNS.map((column) => {
                  const isActive = sortKey === column.key;
                  const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
                  return (
                    <th
                      key={column.key}
                      className={`py-2 pr-3 font-normal ${column.hide} ${column.sticky ? "sticky left-0 z-10 bg-background" : ""}`}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => onSort(column.key)}
                      >
                        {column.label}
                        <span className={isActive ? "text-foreground" : "text-faint"}>{arrow}</span>
                      </button>
                    </th>
                  );
                })}
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.stock_id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-background py-2 pr-3">
                    <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
                      {r.display_name}
                    </Link>
                  </td>
                  <td className="hidden py-2 pr-3 text-muted sm:table-cell">{r.sector || "—"}</td>
                  <td className="py-2 pr-3">{r.fund_count}</td>
                  <td className="hidden py-2 pr-3 md:table-cell">
                    <Delta value={r.net_qty_delta} />
                  </td>
                  <td className="py-2 pr-3">
                    <Delta value={r.net_value_delta_cr} />
                  </td>
                  <td className="hidden py-2 pr-3 sm:table-cell">{formatNumber(r.median_weight_pct)}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:border-faint hover:text-foreground"
                      onClick={() => toggle(r.stock_id)}
                    >
                      {watch.includes(r.stock_id) ? "Watched" : "Watch"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

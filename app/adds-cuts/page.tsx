"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ChaseTable, type SortKey } from "@/components/chase-table";
import { LoadError, SummaryCardSkeleton, TableSkeleton, UpdatingNote } from "@/components/load-ui";
import { loadWatchlist, saveWatchlist } from "@/components/ui";
import { formatNumber, sectorLabel } from "@/lib/format";
import { chaseCacheKey, sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";
import type { ChaseRow } from "@/lib/types";

const SKELETON_COLS = [
  { label: "Stock" },
  { label: "Sector", hide: "hidden sm:table-cell" },
  { label: "Funds" },
  { label: "Net qty", hide: "hidden md:table-cell" },
  { label: "Net ₹ cr" },
  { label: "Median wt %", hide: "hidden sm:table-cell" },
  { label: "" },
];

function sortValue(row: ChaseRow, key: SortKey): string | number {
  if (key === "display_name") return row.display_name.toLowerCase();
  if (key === "sector") return sectorLabel(row.sector).toLowerCase();
  if (key === "median_weight_pct") return row.median_weight_pct ?? Number.NEGATIVE_INFINITY;
  return row[key];
}

function peekChase(month: string) {
  return sessionCacheGet<ChaseRow[]>(chaseCacheKey(month)) ?? [];
}

function ChaseFallback() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Adds & cuts</h1>
        <p className="mt-1 text-sm text-muted">
          Active equity funds only. Adds and cuts use share quantity, not weight. Use{" "}
          <strong>Holdings as of</strong> in the header. Older months may have thinner coverage.
          Books lag month-end by about ten working days. Click a column header to sort.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {["Biggest inflow", "Biggest outflow", "Sector signal"].map((label) => (
          <SummaryCardSkeleton key={label} label={label} />
        ))}
      </div>
      <TableSkeleton columns={SKELETON_COLS} />
    </div>
  );
}

function ChasePage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [allRows, setAllRows] = useState<ChaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [minFunds, setMinFunds] = useState("");
  const [stockQ, setStockQ] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("net_value_delta_cr");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [reload, setReload] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    const key = chaseCacheKey(month);
    const hit = sessionCacheGet<ChaseRow[]>(key);
    if (hit?.length) {
      queueMicrotask(() => {
        if (cancelled) return;
        setAllRows(hit);
        setError(null);
        setLoading(false);
        setUpdating(true);
      });
    } else {
      queueMicrotask(() => {
        if (cancelled) return;
        setLoading(true);
        setUpdating(false);
      });
    }
    const q = new URLSearchParams();
    if (month) q.set("month", month);
    fetch(`/api/v1/chase?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        const next = (d.rows || []) as ChaseRow[];
        if (!r.ok && r.status !== 503) {
          setError(d.error || "Failed to load");
          if (next.length) setAllRows(next);
          return;
        }
        setError(null);
        setAllRows(next);
        if (r.ok) sessionCacheSet(key, next);
      })
      .catch(() => {
        if (cancelled) return;
        if (!sessionCacheGet<ChaseRow[]>(key)?.length) setError("Failed to load");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setUpdating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  useLayoutEffect(() => {
    const hit = peekChase(month);
    queueMicrotask(() => {
      if (hit.length) {
        setAllRows(hit);
        setError(null);
        setLoading(false);
      } else {
        setAllRows([]);
        setLoading(true);
      }
    });
  }, [month]);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 500);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    queueMicrotask(() => setWatch(loadWatchlist()));
  }, []);

  useEffect(() => {
    return load();
  }, [load, reload]);

  const rows = useMemo(() => {
    const min = Number(minFunds) || 0;
    return allRows.filter((r) => {
      if (sector && sectorLabel(r.sector).toLowerCase() !== sector.toLowerCase()) return false;
      if (min > 0 && r.fund_count < min) return false;
      return true;
    });
  }, [allRows, sector, minFunds]);

  const tableRows = useMemo(() => {
    const q = stockQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.display_name.toLowerCase().includes(q) || r.stock_id.toLowerCase().includes(q)
    );
  }, [rows, stockQ]);

  const sectors = useMemo(
    () => [...new Set(allRows.map((r) => sectorLabel(r.sector)))].sort((a, b) => a.localeCompare(b, "en-IN")),
    [allRows]
  );

  const sortedRows = useMemo(() => {
    const next = [...tableRows];
    next.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "en-IN");
      else cmp = Number(av) - Number(bv);
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return next;
  }, [tableRows, sortKey, sortOrder]);

  const summary = useMemo(() => {
    const biggestInflows = [...rows]
      .filter((r) => r.net_value_delta_cr > 0)
      .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr);

    const biggestOutflows = [...rows]
      .filter((r) => r.net_value_delta_cr < 0)
      .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr);

    const sectorTotals = new Map<string, number>();
    rows.forEach((r) => {
      const key = sectorLabel(r.sector);
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

  const showSkeleton = loading && allRows.length === 0 && !error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium">Adds & cuts</h1>
          <p className="mt-1 text-sm text-muted">
            Active equity funds only. Adds and cuts use share quantity, not weight. Use{" "}
            <strong>Holdings as of</strong> in the header. Older months may have thinner coverage.
            Books lag month-end by about ten working days. Click a column header to sort.
          </p>
        </div>
        {updating ? <UpdatingNote /> : null}
      </div>
      {error ? <LoadError message={error} onRetry={() => setReload((n) => n + 1)} /> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {showSkeleton ? (
          <>
            <SummaryCardSkeleton label="Biggest inflow" />
            <SummaryCardSkeleton label="Biggest outflow" />
            <SummaryCardSkeleton label="Sector signal" />
          </>
        ) : (
          <>
            <div className="rounded border border-border bg-card p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-faint">Biggest inflow</div>
              <div className="mt-2 text-base font-medium text-foreground">
                {summary.inflow ? summary.inflow.display_name : "—"}
              </div>
              <div className="mt-1 text-sm text-gain">
                {summary.inflow
                  ? `+${formatNumber(summary.inflow.net_value_delta_cr, 1)} ₹ cr`
                  : "No positive movers"}
              </div>
            </div>

            <div className="rounded border border-border bg-card p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-faint">Biggest outflow</div>
              <div className="mt-2 text-base font-medium text-foreground">
                {summary.outflow ? summary.outflow.display_name : "—"}
              </div>
              <div className="mt-1 text-sm text-loss">
                {summary.outflow
                  ? `${formatNumber(summary.outflow.net_value_delta_cr, 1)} ₹ cr`
                  : "No negative movers"}
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
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Sector
          <select
            className="w-36 rounded border border-border bg-input px-2 py-1"
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
            placeholder="Any"
            inputMode="numeric"
          />
        </label>
        <label className="flex items-center gap-2">
          Stock
          <input
            type="search"
            className="w-48 rounded border border-border bg-input px-2 py-1"
            value={stockQ}
            onChange={(e) => setStockQ(e.target.value)}
            placeholder="Name"
            autoComplete="off"
          />
        </label>
      </div>
      {showSkeleton ? (
        <TableSkeleton columns={SKELETON_COLS} rows={12} />
      ) : error && allRows.length === 0 ? null : allRows.length === 0 ? (
        <p className="text-sm text-faint">
          No rows. Apply the SQL migration in Supabase, set <code>.env.local</code>, then run{" "}
          <code>npm run ingest</code>.
        </p>
      ) : tableRows.length === 0 ? (
        <p className="text-sm text-faint">No stocks match these filters.</p>
      ) : (
        <ChaseTable
          rows={sortedRows}
          month={month}
          sortKey={sortKey}
          sortOrder={sortOrder}
          watch={watch}
          onSort={onSort}
          onToggleWatch={toggle}
        />
      )}
      {showTop ? (
        <button
          type="button"
          className="fixed right-4 bottom-6 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted shadow-sm hover:text-foreground"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M3 10.5 8 5.5l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export default function ChaseRoute() {
  return (
    <Suspense fallback={<ChaseFallback />}>
      <ChasePage />
    </Suspense>
  );
}

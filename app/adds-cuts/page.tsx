"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChaseTable, type SortKey } from "@/components/chase-table";
import { LoadError, SummaryCardSkeleton, TableSkeleton } from "@/components/load-ui";
import { loadWatchlist, saveWatchlist } from "@/components/ui";
import { formatNumber, sectorLabel } from "@/lib/format";
import { peekMonths } from "@/lib/load-months";
import { chaseLooksComplete, loadChaseIntoCache } from "@/lib/prefetch-home";
import {
  chaseCacheKey,
  sessionCacheGet,
  sessionCacheSubscribe,
} from "@/lib/session-cache";
import type { ChaseRow } from "@/lib/types";

const EMPTY_ROWS: ChaseRow[] = [];

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

function useCachedChase(month: string) {
  const key = chaseCacheKey(month);
  return useSyncExternalStore(
    sessionCacheSubscribe,
    () => sessionCacheGet<ChaseRow[]>(key) ?? EMPTY_ROWS,
    () => EMPTY_ROWS,
  );
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
      <div className="grid gap-2 sm:grid-cols-3">
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
  const month = search.get("month") || peekMonths()[0] || "";
  const allRows = useCachedChase(month);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [minFunds, setMinFunds] = useState("");
  const [stockQ, setStockQ] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("net_value_delta_cr");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(allRows.length === 0);
  const [reload, setReload] = useState(0);
  const watched = useMemo(() => new Set(watch), [watch]);

  useEffect(() => {
    queueMicrotask(() => setWatch(loadWatchlist()));
  }, []);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 400);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const hit = reload === 0 ? sessionCacheGet<ChaseRow[]>(chaseCacheKey(month)) : undefined;
    if (hit?.length) {
      queueMicrotask(() => {
        setLoading(false);
        setError(null);
      });
      if (reload === 0 && chaseLooksComplete(hit.length)) return;
    }
    let cancelled = false;
    if (!hit?.length) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(true);
      });
    }
    loadChaseIntoCache(month, reload > 0)
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((e) => {
        if (cancelled || sessionCacheGet<ChaseRow[]>(chaseCacheKey(month))?.length) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, reload]);

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
      <div>
        <h1 className="text-xl font-medium">Adds & cuts</h1>
        <p className="mt-1 text-sm text-muted">
          Active equity funds only. Adds and cuts use share quantity, not weight. Use{" "}
          <strong>Holdings as of</strong> in the header. Older months may have thinner coverage.
          Books lag month-end by about ten working days. Click a column header to sort.
        </p>
      </div>
      {error ? <LoadError message={error} onRetry={() => setReload((n) => n + 1)} /> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {showSkeleton ? (
          <>
            <SummaryCardSkeleton label="Biggest inflow" />
            <SummaryCardSkeleton label="Biggest outflow" />
            <SummaryCardSkeleton label="Sector signal" />
          </>
        ) : (
          <>
            <div className="rounded border border-border bg-card px-3 py-2">
              <div className="text-xs uppercase tracking-[0.12em] text-faint">Biggest inflow</div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {summary.inflow ? summary.inflow.display_name : "—"}
                {summary.inflow ? (
                  <span className="ml-2 font-normal text-gain">
                    +{formatNumber(summary.inflow.net_value_delta_cr, 1)} ₹ cr
                  </span>
                ) : (
                  <span className="ml-2 font-normal text-muted">No positive movers</span>
                )}
              </div>
            </div>

            <div className="rounded border border-border bg-card px-3 py-2">
              <div className="text-xs uppercase tracking-[0.12em] text-faint">Biggest outflow</div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {summary.outflow ? summary.outflow.display_name : "—"}
                {summary.outflow ? (
                  <span className="ml-2 font-normal text-loss">
                    {formatNumber(summary.outflow.net_value_delta_cr, 1)} ₹ cr
                  </span>
                ) : (
                  <span className="ml-2 font-normal text-muted">No negative movers</span>
                )}
              </div>
            </div>

            <div className="rounded border border-border bg-card px-3 py-2">
              <div className="text-xs uppercase tracking-[0.12em] text-faint">Sector signal</div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {summary.leadingSector ? summary.leadingSector.name : "—"}
                {summary.leadingSector ? (
                  <span className="ml-2 font-normal text-muted">
                    {summary.leadingSector.value > 0 ? "Net inflow" : "Net outflow"}{" "}
                    {formatNumber(Math.abs(summary.leadingSector.value), 1)} ₹ cr
                  </span>
                ) : (
                  <span className="ml-2 font-normal text-muted">No sector signal</span>
                )}
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
          watched={watched}
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

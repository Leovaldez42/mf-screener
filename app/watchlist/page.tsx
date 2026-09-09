"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LoadError, TableSkeleton, UpdatingNote } from "@/components/load-ui";
import { Delta, loadWatchlist, saveWatchlist } from "@/components/ui";
import type { ChaseRow } from "@/lib/types";

const COLS = [
  { label: "Stock" },
  { label: "Sector", hide: "hidden sm:table-cell" },
  { label: "Funds" },
  { label: "Net ₹ cr" },
  { label: "" },
];

function WatchlistFallback() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Watchlist</h1>
      <TableSkeleton columns={COLS} rows={6} />
    </div>
  );
}

function WatchlistInner() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<ChaseRow[]>([]);
  const [ids, setIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const hasRows = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setIds(loadWatchlist()));
  }, []);

  useEffect(() => {
    if (ids === null) return;
    if (ids.length === 0) {
      queueMicrotask(() => {
        setRows([]);
        hasRows.current = false;
        setLoading(false);
        setUpdating(false);
        setError(null);
      });
      return;
    }
    let cancelled = false;
    if (hasRows.current) setUpdating(true);
    else setLoading(true);
    const q = new URLSearchParams();
    q.set("ids", ids.join(","));
    if (month) q.set("month", month);
    fetch(`/api/v1/chase?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok && r.status !== 503) setError(d.error || "Could not load watchlist");
        else setError(null);
        const byId = new Map<string, ChaseRow>((d.rows || []).map((row: ChaseRow) => [row.stock_id, row]));
        const next = ids.map((id) => byId.get(id)).filter((row): row is ChaseRow => Boolean(row));
        setRows(next);
        hasRows.current = next.length > 0;
      })
      .catch(() => {
        if (!cancelled && !hasRows.current) setError("Could not load watchlist");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setUpdating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, ids, reload]);

  function remove(id: string) {
    const next = (ids || []).filter((x) => x !== id);
    setIds(next);
    saveWatchlist(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium">Watchlist</h1>
          <p className="text-sm text-muted">Saved in this browser. Add names with Watch on Adds & cuts or a stock page.</p>
        </div>
        {updating ? <UpdatingNote /> : null}
      </div>
      {error ? <LoadError message={error} onRetry={() => setReload((n) => n + 1)} /> : null}
      {ids === null || (ids.length > 0 && loading && rows.length === 0) ? (
        <TableSkeleton columns={COLS} rows={6} />
      ) : ids.length === 0 ? (
        <p className="text-sm text-faint">
          Empty. Open{" "}
          <Link className="underline" href="/adds-cuts">
            Adds & cuts
          </Link>{" "}
          and tap Watch on a stock.
        </p>
      ) : error && rows.length === 0 ? null : rows.length === 0 ? (
        <p className="text-sm text-faint">Saved names could not be loaded for this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-faint">
              <tr>
                <th className="py-2 pr-3 font-normal">Stock</th>
                <th className="hidden py-2 pr-3 font-normal sm:table-cell">Sector</th>
                <th className="py-2 pr-3 font-normal">Funds</th>
                <th className="py-2 pr-3 font-normal">Net ₹ cr</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stock_id} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
                      {r.display_name}
                    </Link>
                  </td>
                  <td className="hidden py-2 pr-3 text-muted sm:table-cell">{r.sector || "—"}</td>
                  <td className="py-2 pr-3">{r.fund_count}</td>
                  <td className="py-2 pr-3">
                    <Delta value={r.net_value_delta_cr} />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-faint hover:text-foreground"
                      onClick={() => remove(r.stock_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ids && ids.length > 0 ? (
        <p className="text-xs text-faint">{ids.length} saved</p>
      ) : null}
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<WatchlistFallback />}>
      <WatchlistInner />
    </Suspense>
  );
}

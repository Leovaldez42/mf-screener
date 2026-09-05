"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Delta, LoadingWait, loadWatchlist, saveWatchlist } from "@/components/ui";
import type { ChaseRow } from "@/lib/types";

function WatchlistInner() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<ChaseRow[]>([]);
  const [ids, setIds] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setIds(loadWatchlist()));
  }, []);

  useEffect(() => {
    if (ids === null) return;
    if (ids.length === 0) return;
    queueMicrotask(() => setLoaded(false));
    const q = new URLSearchParams();
    q.set("ids", ids.join(","));
    if (month) q.set("month", month);
    fetch(`/api/v1/chase?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok && r.status !== 503) setError(d.error || "Could not load watchlist");
        else setError(null);
        const byId = new Map<string, ChaseRow>((d.rows || []).map((row: ChaseRow) => [row.stock_id, row]));
        setRows(ids.map((id) => byId.get(id)).filter((row): row is ChaseRow => Boolean(row)));
      })
      .catch(() => setError("Could not load watchlist"))
      .finally(() => setLoaded(true));
  }, [month, ids]);

  function remove(id: string) {
    const next = (ids || []).filter((x) => x !== id);
    setIds(next);
    saveWatchlist(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Watchlist</h1>
        <p className="text-sm text-muted">Saved in this browser. Add names with Watch on Chase or a stock page.</p>
      </div>
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {ids === null ? (
        <LoadingWait label="Loading watchlist…" />
      ) : ids.length === 0 ? (
        <p className="text-sm text-faint">
          Empty. Open{" "}
          <Link className="underline" href="/">
            Chase
          </Link>{" "}
          and tap Watch on a stock.
        </p>
      ) : rows.length === 0 && !loaded ? (
        <LoadingWait label="Loading watchlist…" />
      ) : rows.length === 0 ? (
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
    <Suspense
      fallback={
        <div className="space-y-4">
          <h1 className="text-xl font-medium">Watchlist</h1>
          <LoadingWait label="Loading watchlist…" />
        </div>
      }
    >
      <WatchlistInner />
    </Suspense>
  );
}

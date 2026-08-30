"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Delta, loadWatchlist, saveWatchlist } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { ChaseRow } from "@/lib/types";

export default function ChasePage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<ChaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [minFunds, setMinFunds] = useState("0");
  const [sort, setSort] = useState("abs_value");
  const [watch, setWatch] = useState<string[]>([]);

  useEffect(() => setWatch(loadWatchlist()), []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (month) q.set("month", month);
    if (sector) q.set("sector", sector);
    if (minFunds !== "0") q.set("min_funds", minFunds);
    q.set("sort", sort);
    fetch(`/api/v1/chase?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok && r.status !== 503) setError(d.error || "Failed to load");
        else setError(null);
        setRows(d.rows || []);
      })
      .catch(() => setError("Failed to load"));
  }, [month, sector, minFunds, sort]);

  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter(Boolean))] as string[],
    [rows]
  );

  function toggle(id: string) {
    const next = watch.includes(id) ? watch.filter((x) => x !== id) : [...watch, id];
    setWatch(next);
    saveWatchlist(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Chase</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Active equity funds only. Adds and cuts use share quantity, not weight. Use{" "}
          <strong>Holdings as of</strong> in the header for Jan–Jul 2026 (older months have thinner
          coverage). Books lag month-end by about ten working days.
        </p>
      </div>
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Sector
          <select
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
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
            className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            value={minFunds}
            onChange={(e) => setMinFunds(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          Sort
          <select
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="abs_value">|Net ₹ cr|</option>
            <option value="fund_delta">|Δ funds|</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No rows. Apply the SQL migration in Supabase, set <code>.env.local</code>, then run{" "}
          <code>npm run ingest</code>.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-normal">Stock</th>
                <th className="py-2 pr-3 font-normal">Sector</th>
                <th className="py-2 pr-3 font-normal">Funds</th>
                <th className="py-2 pr-3 font-normal">Δ funds</th>
                <th className="py-2 pr-3 font-normal">Net qty</th>
                <th className="py-2 pr-3 font-normal">Net ₹ cr</th>
                <th className="py-2 pr-3 font-normal">Median wt %</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stock_id} className="border-t border-zinc-800">
                  <td className="py-2 pr-3">
                    <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
                      {r.display_name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{r.sector || "—"}</td>
                  <td className="py-2 pr-3">{r.fund_count}</td>
                  <td className="py-2 pr-3">
                    <Delta value={r.fund_count_delta} />
                  </td>
                  <td className="py-2 pr-3">
                    <Delta value={r.net_qty_delta} />
                  </td>
                  <td className="py-2 pr-3">
                    <Delta value={r.net_value_delta_cr} />
                  </td>
                  <td className="py-2 pr-3">{formatNumber(r.median_weight_pct)}</td>
                  <td className="py-2">
                    <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => toggle(r.stock_id)}>
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

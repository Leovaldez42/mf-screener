"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Delta, loadWatchlist } from "@/components/ui";
import type { ChaseRow } from "@/lib/types";

export default function WatchlistPage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<ChaseRow[]>([]);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => setIds(loadWatchlist()), []);

  useEffect(() => {
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/chase${q}`)
      .then((r) => r.json())
      .then((d) => {
        const all: ChaseRow[] = d.rows || [];
        setRows(all.filter((r) => ids.includes(r.stock_id)));
      });
  }, [month, ids]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Watchlist</h1>
      <p className="text-sm text-zinc-400">Stored in this browser only. Sign-in sync comes later.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Empty. Add names from Chase.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-normal">Stock</th>
              <th className="py-2 pr-3 font-normal">Funds</th>
              <th className="py-2 pr-3 font-normal">Δ funds</th>
              <th className="py-2 font-normal">Net ₹ cr</th>
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
                <td className="py-2 pr-3">{r.fund_count}</td>
                <td className="py-2 pr-3">
                  <Delta value={r.fund_count_delta} />
                </td>
                <td className="py-2">
                  <Delta value={r.net_value_delta_cr} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

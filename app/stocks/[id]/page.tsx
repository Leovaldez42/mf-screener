"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Delta, LoadingWait, loadWatchlist, saveWatchlist } from "@/components/ui";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Payload = {
  stock?: { display_name: string; sector: string | null };
  month?: string;
  history?: { month: string; fund_count: number; fund_count_delta: number }[];
  holders?: {
    family_id: number;
    family_name: string;
    sebi_category: string;
    quantity: number;
    weight_pct: number;
    qty_delta: number;
    event: string;
  }[];
  error?: string;
};

export default function StockPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [data, setData] = useState<Payload | null>(null);
  const [watch, setWatch] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => setWatch(loadWatchlist()));
  }, []);

  useEffect(() => {
    const key = `stock:${id}:${month || "_"}`;
    const hit = sessionCacheGet<Payload>(key);
    if (hit) {
      queueMicrotask(() => setData(hit));
      return;
    }
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/stocks/${id}${q}`)
      .then((r) => r.json())
      .then((d: Payload) => {
        setData(d);
        if (!d.error) sessionCacheSet(key, d);
      });
  }, [id, month]);

  function toggle() {
    const next = watch.includes(id) ? watch.filter((x) => x !== id) : [...watch, id];
    setWatch(next);
    saveWatchlist(next);
  }

  if (!data) return <LoadingWait label="Loading stock…" />;
  if (data.error) return <p className="text-sm text-amber-400">{data.error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">{data.stock?.display_name}</h1>
          <p className="text-sm text-muted">{data.stock?.sector || "No sector"}</p>
        </div>
        <button className="rounded border border-border px-3 py-1 text-sm" onClick={toggle}>
          {watch.includes(id) ? "Watched" : "Watch"}
        </button>
      </div>
      <div>
        <h2 className="mb-2 text-sm text-faint">Crowding</h2>
        <p className="mb-3 text-xs text-muted">
          How many active-equity funds in this universe held the stock that month — not all Indian MFs.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          {(data.history || []).map((h) => (
            <div key={h.month} className="rounded border border-border px-3 py-2">
              <div className="text-faint">{formatMonthLabel(h.month)}</div>
              <div>{h.fund_count} funds</div>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="text-faint">
            <tr>
              <th className="py-2 pr-3 font-normal">Fund</th>
              <th className="py-2 pr-3 font-normal">Category</th>
              <th className="py-2 pr-3 font-normal">Qty</th>
              <th className="py-2 pr-3 font-normal">Weight %</th>
              <th className="py-2 pr-3 font-normal">Δ qty</th>
              <th className="py-2 font-normal">Event</th>
            </tr>
          </thead>
          <tbody>
            {(data.holders || []).map((h) => (
              <tr key={h.family_id} className="border-t border-border">
                <td className="py-2 pr-3">
                  <Link className="hover:underline" href={`/funds/${h.family_id}?month=${month || data.month}`}>
                    {h.family_name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted">{h.sebi_category}</td>
                <td className="py-2 pr-3">{formatNumber(h.quantity, 0)}</td>
                <td className="py-2 pr-3">{formatNumber(h.weight_pct)}</td>
                <td className="py-2 pr-3">
                  <Delta value={h.qty_delta} />
                </td>
                <td className="py-2 text-muted">{h.event}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

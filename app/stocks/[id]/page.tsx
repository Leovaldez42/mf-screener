"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Delta, loadWatchlist, saveWatchlist } from "@/components/ui";
import { formatNumber } from "@/lib/format";

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

  useEffect(() => setWatch(loadWatchlist()), []);

  useEffect(() => {
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/stocks/${id}${q}`)
      .then((r) => r.json())
      .then(setData);
  }, [id, month]);

  function toggle() {
    const next = watch.includes(id) ? watch.filter((x) => x !== id) : [...watch, id];
    setWatch(next);
    saveWatchlist(next);
  }

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (data.error) return <p className="text-sm text-amber-400">{data.error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">{data.stock?.display_name}</h1>
          <p className="text-sm text-zinc-400">{data.stock?.sector || "No sector"}</p>
        </div>
        <button className="rounded border border-zinc-700 px-3 py-1 text-sm" onClick={toggle}>
          {watch.includes(id) ? "Watched" : "Watch"}
        </button>
      </div>
      <div>
        <h2 className="mb-2 text-sm text-zinc-500">Crowding</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {(data.history || []).map((h) => (
            <div key={h.month} className="rounded border border-zinc-800 px-3 py-2">
              <div className="text-zinc-500">{h.month}</div>
              <div>{h.fund_count} funds</div>
              <Delta value={h.fund_count_delta} />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-zinc-500">
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
              <tr key={h.family_id} className="border-t border-zinc-800">
                <td className="py-2 pr-3">
                  <Link className="hover:underline" href={`/funds/${h.family_id}?month=${month || data.month}`}>
                    {h.family_name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-zinc-400">{h.sebi_category}</td>
                <td className="py-2 pr-3">{formatNumber(h.quantity, 0)}</td>
                <td className="py-2 pr-3">{formatNumber(h.weight_pct)}</td>
                <td className="py-2 pr-3">
                  <Delta value={h.qty_delta} />
                </td>
                <td className="py-2 text-zinc-400">{h.event}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

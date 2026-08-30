"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Delta } from "@/components/ui";
import { formatNumber } from "@/lib/format";

type Payload = {
  family?: { name: string; sebi_category: string; amc_slug: string };
  month?: string;
  holdings?: {
    stock_id: string;
    display_name: string;
    sector: string | null;
    quantity: number;
    market_value_cr: number;
    weight_pct: number;
    qty_delta: number;
    event: string;
  }[];
  sectors?: { name: string; weight_pct: number }[];
  error?: string;
};

export default function FundPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/funds/${id}${q}`)
      .then((r) => r.json())
      .then(setData);
  }, [id, month]);

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (data.error) return <p className="text-sm text-amber-400">{data.error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">{data.family?.name}</h1>
        <p className="text-sm text-zinc-400">
          {data.family?.amc_slug} · {data.family?.sebi_category}
        </p>
      </div>
      <div className="space-y-2">
        {(data.sectors || []).slice(0, 8).map((s) => (
          <div key={s.name} className="flex items-center gap-3 text-sm">
            <div className="w-40 truncate text-zinc-400">{s.name}</div>
            <div className="h-2 flex-1 rounded bg-zinc-800">
              <div className="h-2 rounded bg-zinc-400" style={{ width: `${Math.min(100, s.weight_pct)}%` }} />
            </div>
            <div className="w-16 text-right">{formatNumber(s.weight_pct)}%</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-normal">Stock</th>
              <th className="py-2 pr-3 font-normal">Sector</th>
              <th className="py-2 pr-3 font-normal">Weight %</th>
              <th className="py-2 pr-3 font-normal">₹ cr</th>
              <th className="py-2 pr-3 font-normal">Δ qty</th>
              <th className="py-2 font-normal">Event</th>
            </tr>
          </thead>
          <tbody>
            {(data.holdings || []).map((h) => (
              <tr key={h.stock_id} className="border-t border-zinc-800">
                <td className="py-2 pr-3">
                  <Link className="hover:underline" href={`/stocks/${h.stock_id}?month=${month || data.month}`}>
                    {h.display_name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-zinc-400">{h.sector || "—"}</td>
                <td className="py-2 pr-3">{formatNumber(h.weight_pct)}</td>
                <td className="py-2 pr-3">{formatNumber(h.market_value_cr)}</td>
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

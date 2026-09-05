"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Delta } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Payload = {
  family?: { name: string; sebi_category: string; amc_slug: string };
  month?: string | null;
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
  message?: string;
  empty?: boolean;
};

function FundPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    const key = `fund:${id}:${month || "_"}`;
    const hit = sessionCacheGet<Payload>(key);
    if (hit) {
      queueMicrotask(() => setData(hit));
      return;
    }
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/funds/${id}${q}`)
      .then((r) => r.json())
      .then((d: Payload) => {
        setData(d);
        if (!d.error) sessionCacheSet(key, d);
      });
  }, [id, month]);

  if (!data) return <p className="text-sm text-faint">Loading…</p>;
  if (data.error === "no_holdings" || data.error === "not_found") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Holdings for this scheme have not been ingested yet.
        </p>
        <p className="text-sm text-faint">
          Run <code>npm run ingest</code> to pull monthly books for every Direct Growth active-equity
          scheme in the screener. The first load can take a while.
        </p>
      </div>
    );
  }
  if (data.error) return <p className="text-sm text-amber-700 dark:text-amber-400">{data.error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">{data.family?.name}</h1>
        <p className="text-sm text-muted">
          {data.family?.amc_slug} · {data.family?.sebi_category}
          {data.month ? ` · Book as of ${data.month}` : ""}
        </p>
      </div>
      {!data.holdings?.length ? (
        <p className="text-sm text-faint">
          No portfolio lines for this month. Holdings usually publish about ten working days after
          month-end.
        </p>
      ) : null}
      <div className="space-y-2">
        {(data.sectors || []).slice(0, 8).map((s) => (
          <div key={s.name} className="flex items-center gap-3 text-sm">
            <div className="w-40 truncate text-muted">{s.name}</div>
            <div className="h-2 flex-1 rounded bg-surface">
              <div className="h-2 rounded bg-muted" style={{ width: `${Math.min(100, s.weight_pct)}%` }} />
            </div>
            <div className="w-16 text-right">{formatNumber(s.weight_pct)}%</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="text-faint">
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
              <tr key={h.stock_id} className="border-t border-border">
                <td className="py-2 pr-3">
                  <Link className="hover:underline" href={`/stocks/${h.stock_id}?month=${data.month || month}`}>
                    {h.display_name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted">{h.sector || "—"}</td>
                <td className="py-2 pr-3">{formatNumber(h.weight_pct)}</td>
                <td className="py-2 pr-3">{formatNumber(h.market_value_cr)}</td>
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

export default function FundRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-faint">Loading…</p>}>
      <FundPage />
    </Suspense>
  );
}

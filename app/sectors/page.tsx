"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Delta, LoadingWait } from "@/components/ui";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Row = { sector: string; net_value_delta_cr: number; net_qty_delta: number };

export default function SectorsPage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `sectors:${month || "_"}`;
    const hit = sessionCacheGet<Row[]>(key);
    if (hit) {
      queueMicrotask(() => {
        if (cancelled) return;
        setRows(hit);
        setError(null);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const q = month ? `?month=${month}` : "";
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    fetch(`/api/v1/sectors${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok && r.status !== 503) setError(d.error || "Could not load sectors");
        else setError(null);
        const next = (d.rows || []) as Row[];
        setRows(next);
        if (r.ok) sessionCacheSet(key, next);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load sectors");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Sectors</h1>
      <p className="text-sm text-muted">
        Net qty is the sum of share changes. Net ₹ cr is the change in disclosed market value, which
        includes price moves. Selling shares of a name that rose, or selling cheap shares and adding
        fewer expensive ones in the same sector, can show qty down and rupees up. Share counts are
        not comparable across stocks.
      </p>
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {loading ? (
        <LoadingWait label="Loading sector totals…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint">No sector rows for this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-faint">
              <tr>
                <th className="py-2 pr-3 font-normal">Sector</th>
                <th className="py-2 pr-3 font-normal">Net qty</th>
                <th className="py-2 font-normal">Net ₹ cr</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sector} className="border-t border-border">
                  <td className="py-2 pr-3">{r.sector}</td>
                  <td className="py-2 pr-3">
                    <Delta value={r.net_qty_delta} />
                  </td>
                  <td className="py-2">
                    <Delta value={r.net_value_delta_cr} />
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

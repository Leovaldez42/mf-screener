"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { LoadError, TableSkeleton, UpdatingNote } from "@/components/load-ui";
import { Delta } from "@/components/ui";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Row = { sector: string; net_value_delta_cr: number; net_qty_delta: number };

const COLS = [{ label: "Sector" }, { label: "Net qty" }, { label: "Net ₹ cr" }];

function peekSectors(month: string) {
  return sessionCacheGet<Row[]>(`sectors:${month || "_"}`) ?? [];
}

function SectorsFallback() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Sectors</h1>
      <p className="text-sm text-muted">
        Net qty is the sum of share changes. Net ₹ cr is the change in disclosed market value.
      </p>
      <TableSkeleton columns={COLS} rows={8} />
    </div>
  );
}

function SectorsPage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useLayoutEffect(() => {
    const hit = peekSectors(month);
    queueMicrotask(() => {
      if (hit.length) {
        setRows(hit);
        setLoading(false);
      } else {
        setRows([]);
        setLoading(true);
      }
    });
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    const key = `sectors:${month || "_"}`;
    const hit = sessionCacheGet<Row[]>(key);
    if (hit?.length) {
      queueMicrotask(() => {
        if (cancelled) return;
        setRows(hit);
        setError(null);
        setLoading(false);
        setUpdating(true);
      });
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setLoading(true);
          setUpdating(false);
        }
      });
    }
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/sectors${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok && r.status !== 503) {
          setError(d.error || "Could not load sectors");
          return;
        }
        setError(null);
        const next = (d.rows || []) as Row[];
        setRows(next);
        if (r.ok) sessionCacheSet(key, next);
      })
      .catch(() => {
        if (!cancelled && !sessionCacheGet<Row[]>(key)?.length) setError("Could not load sectors");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setUpdating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, reload]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-medium">Sectors</h1>
        {updating ? <UpdatingNote /> : null}
      </div>
      <p className="text-sm text-muted">
        Net qty is the sum of share changes. Net ₹ cr is the change in disclosed market value, which
        includes price moves. Selling shares of a name that rose, or selling cheap shares and adding
        fewer expensive ones in the same sector, can show qty down and rupees up. Share counts are
        not comparable across stocks.
      </p>
      {error ? <LoadError message={error} onRetry={() => setReload((n) => n + 1)} /> : null}
      {loading && rows.length === 0 ? (
        <TableSkeleton columns={COLS} rows={8} />
      ) : error && rows.length === 0 ? null : rows.length === 0 ? (
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

export default function SectorsRoute() {
  return (
    <Suspense fallback={<SectorsFallback />}>
      <SectorsPage />
    </Suspense>
  );
}

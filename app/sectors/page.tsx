"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { LoadError, TableSkeleton, UpdatingNote } from "@/components/load-ui";
import { Delta } from "@/components/ui";
import { isJunkSector, normalizeSectorKey, sectorLabel } from "@/lib/format";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Row = { sector: string; net_value_delta_cr: number; net_qty_delta: number };
type SortKey = "sector" | "net_qty_delta" | "net_value_delta_cr";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "sector", label: "Sector" },
  { key: "net_qty_delta", label: "Net qty" },
  { key: "net_value_delta_cr", label: "Net ₹ cr" },
];

function peekSectors(month: string) {
  return sessionCacheGet<Row[]>(`sectors:${month || "_"}`) ?? [];
}

function foldSectors(rows: Row[]): Row[] {
  const map = new Map<string, Row>();
  for (const r of rows) {
    if (isJunkSector(r.sector)) continue;
    const key = normalizeSectorKey(r.sector);
    if (!key) continue;
    const cur = map.get(key) || {
      sector: sectorLabel(r.sector),
      net_value_delta_cr: 0,
      net_qty_delta: 0,
    };
    cur.net_value_delta_cr += r.net_value_delta_cr;
    cur.net_qty_delta += r.net_qty_delta;
    map.set(key, cur);
  }
  return [...map.values()];
}

function sortValue(row: Row, key: SortKey): string | number {
  if (key === "sector") return row.sector.toLowerCase();
  return row[key];
}

function SectorsFallback() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Sectors</h1>
      <p className="text-sm text-muted">
        Net qty is the sum of share changes. Net ₹ cr is the change in disclosed market value.
      </p>
      <TableSkeleton columns={COLUMNS.map((c) => ({ label: c.label }))} rows={8} />
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
  const [sortKey, setSortKey] = useState<SortKey>("net_value_delta_cr");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  const folded = useMemo(() => foldSectors(rows), [rows]);
  const sorted = useMemo(() => {
    const next = [...folded];
    next.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "en-IN");
      else cmp = Number(av) - Number(bv);
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return next;
  }, [folded, sortKey, sortOrder]);
  const maxAbs = Math.max(1, ...folded.map((r) => Math.abs(r.net_value_delta_cr)));

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "sector" ? "asc" : "desc");
  }

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
        not comparable across stocks. Click a column header to sort.
      </p>
      {error ? <LoadError message={error} onRetry={() => setReload((n) => n + 1)} /> : null}
      {loading && folded.length === 0 ? (
        <TableSkeleton columns={COLUMNS.map((c) => ({ label: c.label }))} rows={8} />
      ) : error && folded.length === 0 ? null : folded.length === 0 ? (
        <p className="text-sm text-faint">No sector rows for this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="border-b border-border bg-background text-muted">
              <tr>
                {COLUMNS.map((column) => {
                  const isActive = sortKey === column.key;
                  const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
                  return (
                    <th key={column.key} className="py-2 pr-3 font-normal">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => onSort(column.key)}
                      >
                        {column.label}
                        <span className={isActive ? "text-foreground" : "text-faint"}>{arrow}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const pct = (Math.abs(r.net_value_delta_cr) / maxAbs) * 100;
                return (
                  <tr key={r.sector} className="border-t border-border">
                    <td className="py-2 pr-3">{r.sector}</td>
                    <td className="py-2 pr-3">
                      <Delta value={r.net_qty_delta} />
                    </td>
                    <td className="py-2">
                      <div className="flex min-w-40 items-center gap-3">
                        <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded bg-surface">
                          <div className="h-1.5 rounded bg-foreground/35" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 shrink-0 text-right">
                          <Delta value={r.net_value_delta_cr} />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

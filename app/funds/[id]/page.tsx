"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Delta } from "@/components/ui";
import { FundSectorMap } from "@/components/fund-sector-map";
import { formatNumber, sectorLabel } from "@/lib/format";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Holding = {
  stock_id: string;
  display_name: string;
  sector: string | null;
  quantity: number;
  market_value_cr: number;
  weight_pct: number;
  qty_delta: number;
  event: string;
};

type Payload = {
  family?: { name: string; sebi_category: string; amc_slug: string };
  month?: string | null;
  holdings?: Holding[];
  sectors?: { name: string; weight_pct: number }[];
  error?: string;
  message?: string;
  empty?: boolean;
};

type SortKey = "display_name" | "sector" | "weight_pct" | "market_value_cr" | "qty_delta" | "event";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "display_name", label: "Stock" },
  { key: "sector", label: "Sector" },
  { key: "weight_pct", label: "Weight %" },
  { key: "market_value_cr", label: "₹ cr" },
  { key: "qty_delta", label: "Δ qty" },
  { key: "event", label: "Event" },
];

function sortValue(row: Holding, key: SortKey): string | number {
  if (key === "display_name") return row.display_name.toLowerCase();
  if (key === "sector") return sectorLabel(row.sector).toLowerCase();
  if (key === "event") return row.event.toLowerCase();
  return row[key];
}

function FundPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [data, setData] = useState<Payload | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("weight_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
        <p className="text-sm text-muted">
          Holdings for this scheme have not been ingested yet.
        </p>
        <p className="text-sm text-faint">
          Adds & cuts books are only ingested for Direct Growth <strong>active-equity</strong> schemes.
          Index, debt, and hybrid funds appear on the screener without a holdings book.
        </p>
      </div>
    );
  }
  if (data.error) return <p className="text-sm text-loss">{data.error}</p>;

  const holdings = data.holdings || [];
  const sorted = [...holdings].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    let cmp = 0;
    if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "en-IN");
    else cmp = Number(av) - Number(bv);
    return sortOrder === "desc" ? -cmp : cmp;
  });

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "display_name" || key === "sector" || key === "event" ? "asc" : "desc");
  }

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
      <FundSectorMap sectors={data.sectors || []} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="text-muted">
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
            {sorted.map((h) => (
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

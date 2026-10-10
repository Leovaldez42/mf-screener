"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DataAsOfNote, Delta, UnavailableMonthNote } from "@/components/ui";
import { FundSectorMap } from "@/components/fund-sector-map";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { instrumentSectorLabel, isCashLikeNonEquity, isEquityInstrument } from "@/lib/instruments";
import { sessionCacheGet, sessionCacheSet } from "@/lib/session-cache";

type Holding = {
  stock_id: string;
  display_name: string;
  sector: string | null;
  isin?: string | null;
  quantity: number;
  market_value_cr: number;
  weight_pct: number;
  qty_delta: number;
  event: string;
};

function holdingSectorLabel(h: Holding): string {
  if (isEquityInstrument(h)) return instrumentSectorLabel(h);
  if (isCashLikeNonEquity(h)) return "Cash & others";
  return "Other instruments";
}

type Payload = {
  family?: { name: string; sebi_category: string; amc_slug: string };
  month?: string | null;
  holdings?: Holding[];
  sectors?: { name: string; weight_pct: number }[];
  availableMonths?: string[];
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
  if (key === "sector") return holdingSectorLabel(row).toLowerCase();
  if (key === "event") return row.event.toLowerCase();
  return row[key];
}

export function FundView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const requested = search.get("month") || "";
  const [data, setData] = useState<Payload | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("weight_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    const key = `fund:${id}:${requested || "_"}`;
    const hit = sessionCacheGet<Payload>(key);
    if (hit && hit.error !== "unknown_month") {
      queueMicrotask(() => setData(hit));
      return;
    }
    const q = requested ? `?month=${requested}` : "";
    fetch(`/api/v1/funds/${id}${q}`)
      .then(async (r) => {
        const d = (await r.json()) as Payload;
        if (cancelled) return;
        if (d.error === "unknown_month") {
          const latest = await fetch(`/api/v1/funds/${id}`);
          const next = (await latest.json()) as Payload;
          if (cancelled) return;
          setData(next);
          if (!next.error) sessionCacheSet(`fund:${id}:_`, next);
          return;
        }
        setData(d);
        if (!d.error) sessionCacheSet(key, d);
      });
    return () => {
      cancelled = true;
    };
  }, [id, requested]);

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

  const months = data.availableMonths || [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-medium">{data.family?.name}</h1>
          <Link className="text-sm text-muted underline hover:text-foreground" href={`/overlap?funds=${id}`}>
            Check overlap
          </Link>
        </div>
        <p className="text-sm text-muted">
          {data.family?.amc_slug} · {data.family?.sebi_category}
          {data.month ? ` · Book as of ${data.month}` : ""}
        </p>
        {months.length ? (
          <div className="mt-2 space-y-1">
            <div className="flex h-8 items-center gap-2 text-sm">
              <span className="text-muted">Holdings as of</span>
              <select
                className="h-8 rounded border border-border bg-input px-2 py-1"
                value={data.month || ""}
                onChange={(e) => {
                  const next = e.target.value;
                  const params = new URLSearchParams(search.toString());
                  if (next) params.set("month", next);
                  else params.delete("month");
                  const qs = params.toString();
                  router.push(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
                }}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <UnavailableMonthNote requested={requested} showing={data.month || ""} />
            <DataAsOfNote />
          </div>
        ) : (
          <div className="mt-2">
            <DataAsOfNote />
          </div>
        )}
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
                  <Link className="hover:underline" href={`/stocks/${h.stock_id}?month=${data.month || requested}`}>
                    {h.display_name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted">
                  {holdingSectorLabel(h)}
                </td>
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

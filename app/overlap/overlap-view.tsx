"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DataAsOfNote, UnavailableMonthNote } from "@/components/ui";
import { assetClassMeta, parseAssetClass } from "@/lib/fund-class";
import { overlapVerdict, type CommonHolding, type OverlapLine } from "@/lib/fund-overlap";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import type { SchemeMetric } from "@/lib/scheme-metrics";

const MAX = 3;

type FundInfo = {
  code: string;
  name: string;
  category: string;
  aum_cr: number | null;
  holdings_count: number;
  months: string[];
};

type Pair = {
  a: string;
  b: string;
  overlap_pct: number;
  common_count: number;
  sector_overlap_pct: number;
  common: CommonHolding[];
  sectors: { name: string; weights: Record<string, number>; min: number }[];
};

type Payload = {
  funds?: FundInfo[];
  month?: string;
  availableMonths?: string[];
  pairs?: Pair[];
  common?: CommonHolding[];
  commonAll?: CommonHolding[];
  unique?: Record<string, OverlapLine[]>;
  singleMonthFunds?: string[];
  error?: string;
  unknown?: string[];
};

type Suggestion = { codes: string[]; names: string[]; category: string };

function parseFunds(raw: string | null): string[] {
  return [...new Set((raw || "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX);
}

function shortName(name: string) {
  return name.replace(/\s+Direct\s+Plan\s+Growth.*$/i, "").replace(/\s+-\s+Direct\s+Growth.*$/i, "").trim() || name;
}

export function OverlapView({
  initialData,
  initialError,
  initialSuggestions,
}: {
  initialData: Payload | null;
  initialError: string | null;
  initialSuggestions: Suggestion[];
}) {
  const search = useSearchParams();
  const router = useRouter();
  const codes = parseFunds(search.get("funds"));
  const requestedMonth = search.get("month") || "";
  const focusPicker = codes.length === 1;
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SchemeMetric[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const data = initialData;
  const error = initialError;
  const suggestions = initialSuggestions;
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (focusPicker) queueMicrotask(() => inputRef.current?.focus());
  }, [focusPicker]);

  useEffect(() => {
    if (q.trim().length < 2) {
      queueMicrotask(() => setHits([]));
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/v1/schemes?q=${encodeURIComponent(q.trim())}&limit=12&sort=aum_cr&class=all`)
        .then((r) => r.json())
        .then((d) => setHits(d.schemes || []))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function setFunds(next: string[]) {
    const params = new URLSearchParams(search.toString());
    if (next.length) params.set("funds", next.join(","));
    else params.delete("funds");
    params.delete("month");
    const qs = params.toString();
    router.replace(`/overlap${qs ? `?${qs}` : ""}`);
  }

  function add(code: string, name?: string) {
    if (name) setNames((prev) => ({ ...prev, [code]: name }));
    if (codes.includes(code) || codes.length >= MAX) return;
    setFunds([...codes, code]);
    setQ("");
    setHits([]);
  }

  function remove(code: string) {
    setFunds(codes.filter((c) => c !== code));
  }

  function setMonth(next: string) {
    const params = new URLSearchParams(search.toString());
    if (next) params.set("month", next);
    else params.delete("month");
    const qs = params.toString();
    router.replace(`/overlap${qs ? `?${qs}` : ""}`);
  }

  const funds = data?.funds || [];
  const pairs = data?.pairs || [];
  const headlinePct = pairs.length === 1 ? pairs[0].overlap_pct : pairs.length
    ? pairs.reduce((s, p) => s + p.overlap_pct, 0) / pairs.length
    : 0;
  const verdict = overlapVerdict(headlinePct);
  const common = (data?.common || []).slice();
  const visibleCommon = showAll ? common : common.slice(0, 15);
  const months = data?.availableMonths || [];
  const showingMonth = data?.month || months[0] || "";
  const nameOf = (code: string) =>
    funds.find((f) => f.code === code)?.name || names[code] || code;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">Fund overlap</h1>
        <p className="mt-1 text-sm text-muted">
          Compare the equity books of two or three Direct Growth funds. Overlap is the sum of the
          smaller weight in each shared stock.
        </p>
      </div>

      <div className="relative z-30 max-w-xl">
        <input
          ref={inputRef}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={codes.length >= MAX ? "Remove a fund to add another" : "Name or AMC…"}
          disabled={codes.length >= MAX}
        />
        {hits.length > 0 && codes.length < MAX ? (
          <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded border border-border bg-card text-sm shadow-sm">
            {hits.map((h) => (
              <li key={h.scheme_code}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-surface"
                  onClick={() => add(h.scheme_code, h.name)}
                >
                  <div>{h.name}</div>
                  <div className="text-xs text-faint">
                    {assetClassMeta(parseAssetClass(h.asset_class)).label} · {h.fund_house} · {h.category}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {codes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {codes.map((c) => (
            <button
              key={c}
              type="button"
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted hover:border-faint"
              onClick={() => remove(c)}
            >
              {shortName(nameOf(c))} ×
            </button>
          ))}
        </div>
      ) : null}

      {codes.length < 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-faint">Add two or three funds to see how much their books overlap.</p>
          {suggestions.length ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-faint">
                Popular same-category pairs
              </div>
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s.codes.join("-")}>
                    <Link
                      className="text-sm text-muted hover:text-foreground hover:underline"
                      href={`/overlap?funds=${s.codes.join(",")}`}
                    >
                      {shortName(s.names[0])} vs {shortName(s.names[1])}
                    </Link>
                    <div className="text-xs text-faint">{s.category}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-loss">{error}</p> : null}

      {codes.length >= 2 && data && !error ? (
        <>
          <div className="space-y-1">
            {months.length ? (
              <div className="flex h-8 flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Holdings as of</span>
                <select
                  className="h-8 rounded border border-border bg-input px-2 py-1"
                  value={showingMonth}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <UnavailableMonthNote requested={requestedMonth} showing={showingMonth} />
            <DataAsOfNote />
            {data.singleMonthFunds?.length ? (
              <p className="text-xs text-muted">
                {data.singleMonthFunds.map((c) => shortName(nameOf(c))).join(" and ")}{" "}
                {data.singleMonthFunds.length === 1 ? "only has" : "only have"} one month of holdings.
              </p>
            ) : null}
          </div>

          {pairs.length && data.month ? (
            <section className="space-y-2">
              {pairs.length === 1 ? (
                <>
                  <div className="text-4xl font-medium tabular-nums">{formatNumber(pairs[0].overlap_pct, 1)}%</div>
                  <p className="text-sm text-muted">{verdict.text}</p>
                  <p className="text-xs text-faint">
                    {pairs[0].common_count} shared stocks · sector overlap {formatNumber(pairs[0].sector_overlap_pct, 1)}%
                  </p>
                </>
              ) : (
                <>
                  <PairMatrix funds={funds} pairs={pairs} />
                  <p className="text-sm text-muted">{verdict.text}</p>
                </>
              )}
            </section>
          ) : null}

          {data.month ? (
            <>
              <CommonTable
                funds={funds}
                rows={visibleCommon}
                total={common.length}
                showAll={showAll}
                onShowAll={() => setShowAll(true)}
                title={funds.length === 3 ? "Held by all three" : "Common holdings"}
              />
              <UniqueColumns funds={funds} unique={data.unique || {}} />
              {pairs[0] ? <SectorBars pair={pairs[0]} funds={funds} /> : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PairMatrix({ funds, pairs }: { funds: FundInfo[]; pairs: Pair[] }) {
  function cell(a: string, b: string) {
    if (a === b) return "—";
    const hit = pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
    return hit ? `${formatNumber(hit.overlap_pct, 1)}%` : "—";
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-80 text-left text-sm tabular-nums">
        <thead className="text-muted">
          <tr>
            <th className="py-2 pr-3 font-normal" />
            {funds.map((f) => (
              <th key={f.code} className="py-2 pr-3 font-normal">
                {shortName(f.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {funds.map((row) => (
            <tr key={row.code} className="border-t border-border">
              <td className="py-2 pr-3 text-muted">{shortName(row.name)}</td>
              {funds.map((col) => (
                <td key={col.code} className="py-2 pr-3">
                  {cell(row.code, col.code)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommonTable({
  funds,
  rows,
  total,
  showAll,
  onShowAll,
  title,
}: {
  funds: FundInfo[];
  rows: CommonHolding[];
  total: number;
  showAll: boolean;
  onShowAll: () => void;
  title: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-faint">No shared equity holdings in this month.</p>;
  }
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-140 text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 pr-3 font-normal">Stock</th>
              <th className="py-2 pr-3 font-normal">Sector</th>
              {funds.map((f) => (
                <th key={f.code} className="py-2 pr-3 font-normal">
                  {shortName(f.name)} %
                </th>
              ))}
              <th className="py-2 font-normal">Min %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stock_id} className="border-t border-border">
                <td className="py-2 pr-3">
                  <Link className="hover:underline" href={`/stocks/${row.stock_id}`}>
                    {row.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted">{row.sector}</td>
                {funds.map((f) => (
                  <td key={f.code} className="py-2 pr-3 tabular-nums">
                    {formatNumber(row.weights[f.code] ?? null, 2)}
                  </td>
                ))}
                <td className="py-2 tabular-nums">{formatNumber(row.min_weight, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && total > 15 ? (
        <button type="button" className="text-sm text-muted underline hover:text-foreground" onClick={onShowAll}>
          View all {total}
        </button>
      ) : null}
    </section>
  );
}

function UniqueColumns({ funds, unique }: { funds: FundInfo[]; unique: Record<string, OverlapLine[]> }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Top unique holdings</h2>
      <div className={`grid gap-3 ${funds.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {funds.map((f) => (
          <div key={f.code} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">{shortName(f.name)}</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(unique[f.code] || []).map((h) => (
                <li key={h.stock_id} className="flex justify-between gap-2">
                  <Link className="min-w-0 truncate hover:underline" href={`/stocks/${h.stock_id}`}>
                    {h.display_name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted">{formatNumber(h.weight_pct, 2)}</span>
                </li>
              ))}
              {!(unique[f.code] || []).length ? (
                <li className="text-xs text-faint">No unique equity names in the top of this book.</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectorBars({ pair, funds }: { pair: Pair; funds: FundInfo[] }) {
  const a = funds.find((f) => f.code === pair.a);
  const b = funds.find((f) => f.code === pair.b);
  const rows = (pair.sectors || []).slice(0, 8).map((r) => ({
    name: r.name,
    a: r.weights[pair.a] || 0,
    b: r.weights[pair.b] || 0,
    min: r.min,
  }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Sector overlap</h2>
      <p className="text-xs text-faint">
        Shared-stock weights by sector · pair overlap {formatNumber(pair.sector_overlap_pct, 1)}%
      </p>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="mb-1 flex justify-between gap-2 text-xs text-muted">
              <span>{r.name}</span>
              <span className="tabular-nums">min {formatNumber(r.min, 1)}%</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] text-faint">{shortName(a?.name || "")}</span>
                <div className="h-1.5 flex-1 rounded-full bg-surface">
                  <div className="h-1.5 rounded-full bg-foreground/70" style={{ width: `${(r.a / max) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
                  {formatNumber(r.a, 1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] text-faint">{shortName(b?.name || "")}</span>
                <div className="h-1.5 flex-1 rounded-full bg-surface">
                  <div className="h-1.5 rounded-full bg-foreground/40" style={{ width: `${(r.b / max) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
                  {formatNumber(r.b, 1)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

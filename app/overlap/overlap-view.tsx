"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SectorPill } from "@/components/sector-pill";
import { DataAsOfNote, UnavailableMonthNote } from "@/components/ui";
import { sectorFill } from "@/lib/sector-color";
import { assetClassMeta, parseAssetClass } from "@/lib/fund-class";
import { fundsHubPath, shortCategoryLabel, shortFundLabel } from "@/lib/funds-hub";
import { overlapVerdict, type CommonHolding, type OverlapLine } from "@/lib/fund-overlap";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import type { SchemeMetric } from "@/lib/scheme-metrics";

const MAX = 3;
const PREVIEW_COMMON = 5;
const FUND_BAR = ["var(--accent)", "#ea580c", "#0d9488"];

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
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);
  const inputC = useRef<HTMLInputElement>(null);
  const inputRefs = [inputA, inputB, inputC];

  const [q, setQ] = useState(["", "", ""]);
  const [hits, setHits] = useState<SchemeMetric[][]>([[], [], []]);
  const [names, setNames] = useState<Record<string, string>>({});
  const data = initialData;
  const error = initialError;
  const suggestions = initialSuggestions;
  const [showAll, setShowAll] = useState(false);
  const [wantThird, setWantThird] = useState(false);

  useEffect(() => {
    if (focusPicker) queueMicrotask(() => inputRefs[1].current?.focus());
  }, [focusPicker]);

  useEffect(() => {
    const timers = q.map((query, i) => {
      if (query.trim().length < 2) {
        queueMicrotask(() =>
          setHits((prev) => {
            const next = [...prev];
            next[i] = [];
            return next;
          }),
        );
        return null;
      }
      return setTimeout(() => {
        fetch(`/api/v1/schemes?q=${encodeURIComponent(query.trim())}&limit=12&sort=aum_cr&class=all`)
          .then((r) => r.json())
          .then((d) =>
            setHits((prev) => {
              const next = [...prev];
              next[i] = d.schemes || [];
              return next;
            }),
          )
          .catch(() =>
            setHits((prev) => {
              const next = [...prev];
              next[i] = [];
              return next;
            }),
          );
      }, 200);
    });
    return () => {
      for (const t of timers) if (t) clearTimeout(t);
    };
  }, [q]);

  function setFunds(next: string[], month = requestedMonth) {
    const p = new URLSearchParams();
    if (next.length) p.set("funds", next.join(","));
    if (month) p.set("month", month);
    router.replace(fundsHubPath("overlap", p), { scroll: false });
  }

  function addAt(slot: number, code: string, name?: string) {
    if (name) setNames((prev) => ({ ...prev, [code]: name }));
    if (codes.includes(code)) return;
    const next = codes.slice();
    if (slot < next.length) next[slot] = code;
    else if (next.length < MAX) next.push(code);
    else return;
    setFunds(next);
    setQ((prev) => {
      const copy = [...prev];
      copy[slot] = "";
      return copy;
    });
    setHits((prev) => {
      const copy = [...prev];
      copy[slot] = [];
      return copy;
    });
  }

  function removeAt(slot: number) {
    setFunds(codes.filter((_, i) => i !== slot));
  }

  function swapFunds() {
    if (codes.length < 2) return;
    const next = [...codes];
    [next[0], next[1]] = [next[1], next[0]];
    setFunds(next);
  }

  function setMonth(next: string) {
    setFunds(codes, next);
  }

  const funds = data?.funds || [];
  const pairs = data?.pairs || [];
  const headlinePct = pairs.length === 1 ? pairs[0].overlap_pct : pairs.length ? pairs.reduce((s, p) => s + p.overlap_pct, 0) / pairs.length : 0;
  const verdict = overlapVerdict(headlinePct);
  const common = (data?.common || []).slice();
  const visibleCommon = showAll ? common : common.slice(0, PREVIEW_COMMON);
  const months = data?.availableMonths || [];
  const showingMonth = data?.month || months[0] || "";
  const nameOf = (code: string) => funds.find((f) => f.code === code)?.name || names[code] || code;
  const slotCount = codes.length >= 3 || wantThird ? 3 : 2;
  const commonCount = pairs.length === 1 ? pairs[0].common_count : common.length;
  const sectorPct = pairs.length === 1 ? pairs[0].sector_overlap_pct : pairs[0]?.sector_overlap_pct ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          {Array.from({ length: slotCount }).map((_, slot) => (
            <div key={slot} className="min-w-0 flex-1">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
                Fund {slot === 0 ? "A" : slot === 1 ? "B" : "C"}
              </div>
              {codes[slot] ? (
                <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{shortFundLabel(nameOf(codes[slot]))}</div>
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">
                    {shortCategoryLabel(funds.find((f) => f.code === codes[slot])?.category)}
                  </span>
                  <button type="button" className="shrink-0 text-sm text-muted hover:text-foreground" onClick={() => removeAt(slot)}>
                    ×
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    ref={inputRefs[slot]}
                    className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm"
                    value={q[slot]}
                    onChange={(e) =>
                      setQ((prev) => {
                        const copy = [...prev];
                        copy[slot] = e.target.value;
                        return copy;
                      })
                    }
                    placeholder="Name or AMC…"
                  />
                  {hits[slot]?.length ? (
                    <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded border border-border bg-card text-sm shadow-sm">
                      {hits[slot].map((h) => (
                        <li key={h.scheme_code}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-surface"
                            onClick={() => addAt(slot, h.scheme_code, h.name)}
                          >
                            <div>{shortFundLabel(h.name)}</div>
                            <div className="text-xs text-faint">
                              {assetClassMeta(parseAssetClass(h.asset_class)).label} · {h.fund_house} · {h.category}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          {codes.length >= 2 ? (
            <button
              type="button"
              className="h-11 w-11 shrink-0 self-end rounded-md border border-border text-muted hover:text-foreground"
              onClick={swapFunds}
              aria-label="Swap funds"
            >
              ⇄
            </button>
          ) : null}
          <button
            type="button"
            className="h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40"
            disabled={codes.length < 2}
            onClick={() => document.getElementById("overlap-results")?.scrollIntoView({ behavior: "smooth" })}
          >
            Check overlap
          </button>
        </div>
        {codes.length === 2 && !wantThird ? (
          <button type="button" className="mt-2 text-xs text-muted underline hover:text-foreground" onClick={() => setWantThird(true)}>
            Add a third fund
          </button>
        ) : null}
      </div>

      {codes.length < 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-faint">Add two or three funds to see how much their books overlap.</p>
          {suggestions.length ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-faint">Popular same-category pairs</div>
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s.codes.join("-")}>
                    <Link className="text-sm text-muted hover:text-foreground hover:underline" href={fundsHubPath("overlap", { funds: s.codes.join(",") })}>
                      {shortFundLabel(s.names[0])} vs {shortFundLabel(s.names[1])}
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
        <div id="overlap-results" className="space-y-6">
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
                {data.singleMonthFunds.map((c) => shortFundLabel(nameOf(c))).join(" and ")}{" "}
                {data.singleMonthFunds.length === 1 ? "only has" : "only have"} one month of holdings.
              </p>
            ) : null}
          </div>

          {pairs.length && data.month ? (
            pairs.length === 1 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Portfolio overlap</div>
                  <div className="mt-2 text-5xl font-medium tabular-nums tracking-tight">{formatNumber(headlinePct, 2)}%</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        verdict.level === "low"
                          ? "bg-gain-muted text-gain"
                          : verdict.level === "high"
                            ? "bg-loss-muted text-loss"
                            : "bg-surface text-muted"
                      }`}
                    >
                      {verdict.level === "low" ? "Low overlap" : verdict.level === "high" ? "High overlap" : "Moderate overlap"}
                    </span>
                    <span className="text-sm text-muted">{verdict.text.replace(/^[^—]+—\s*/, "")}</span>
                  </div>
                  <OverlapScale pct={headlinePct} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Common stocks</div>
                  <div className="mt-2 text-5xl font-medium tabular-nums">{commonCount}</div>
                  <p className="mt-3 text-sm text-muted">
                    Held by both funds{showingMonth ? ` in ${formatMonthLabel(showingMonth)}` : ""}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Sector overlap</div>
                  <div className="mt-2 text-5xl font-medium tabular-nums">{formatNumber(sectorPct, 1)}%</div>
                  <p className="mt-3 text-sm text-muted">Similar sector mix, different stock picks</p>
                </div>
              </div>
            ) : (
              <>
                <PairMatrix funds={funds} pairs={pairs} />
                <p className="text-sm text-muted">{verdict.text}</p>
              </>
            )
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
        </div>
      ) : null}
    </div>
  );
}

function OverlapScale({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-4">
      <div className="relative h-1.5 overflow-hidden rounded-full">
        <div className="absolute inset-0 flex">
          <div className="w-[20%] bg-gain" />
          <div className="w-[30%] bg-amber-400" />
          <div className="flex-1 bg-loss/70" />
        </div>
        <div className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: `${clamped}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        <span>Low · under 20%</span>
        <span>Moderate</span>
        <span>High · over 50%</span>
      </div>
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
                {shortFundLabel(f.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {funds.map((row) => (
            <tr key={row.code} className="border-t border-border">
              <td className="py-2 pr-3 text-muted">{shortFundLabel(row.name)}</td>
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
  const maxW = Math.max(1, ...rows.flatMap((r) => funds.map((f) => r.weights[f.code] || 0)));
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-faint">Largest shared positions by overlap contribution</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {funds.map((f, i) => (
            <span key={f.code} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: FUND_BAR[i] || FUND_BAR[0] }} />
              {shortFundLabel(f.name)}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-140 text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Stock</th>
              <th className="py-2 pr-3 font-normal">Sector</th>
              {funds.map((f) => (
                <th key={f.code} className="py-2 pr-3 text-right font-normal">
                  {shortFundLabel(f.name)}
                </th>
              ))}
              <th className="py-2 pr-3 text-right font-normal">Overlap</th>
              <th className="py-2 pr-4 font-normal">Weights</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stock_id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <Link className="hover:underline" href={`/stocks/${row.stock_id}`}>
                    {row.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <SectorPill sector={row.sector} />
                </td>
                {funds.map((f) => (
                  <td key={f.code} className="py-2.5 pr-3 text-right tabular-nums text-muted">
                    {formatNumber(row.weights[f.code] ?? null, 2)}%
                  </td>
                ))}
                <td className="py-2.5 pr-3 text-right font-medium tabular-nums">{formatNumber(row.min_weight, 2)}%</td>
                <td className="py-2.5 pr-4">
                  <div className="w-24 space-y-1">
                    {funds.map((f, i) => (
                      <div key={f.code} className="h-1.5 rounded-full bg-raised">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${((row.weights[f.code] || 0) / maxW) * 100}%`,
                            background: FUND_BAR[i] || FUND_BAR[0],
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted">
          <span>
            Showing {rows.length} of {total} common stocks · Overlap = sum of the smaller weight of each shared stock
          </span>
          {!showAll && total > PREVIEW_COMMON ? (
            <button type="button" className="text-accent hover:underline" onClick={onShowAll}>
              View all {total} →
            </button>
          ) : null}
        </div>
      </div>
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
            <div className="text-xs uppercase tracking-[0.12em] text-faint">{shortFundLabel(f.name)}</div>
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
                <span className="w-24 shrink-0 truncate text-[11px] text-faint">{shortFundLabel(a?.name || "")}</span>
                <div className="h-1.5 flex-1 rounded-full bg-raised">
                  <div className="h-1.5 rounded-full" style={{ width: `${(r.a / max) * 100}%`, background: sectorFill(r.name) }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">{formatNumber(r.a, 1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] text-faint">{shortFundLabel(b?.name || "")}</span>
                <div className="h-1.5 flex-1 rounded-full bg-raised">
                  <div
                    className="h-1.5 rounded-full opacity-70"
                    style={{ width: `${(r.b / max) * 100}%`, background: sectorFill(r.name) }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">{formatNumber(r.b, 1)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

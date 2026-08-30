"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COMPARE_MAX, type SchemeMetric } from "@/lib/scheme-metrics";
import { formatNumber } from "@/lib/format";
import { loadCompare, saveCompare } from "@/components/ui";

export default function ScreenerPage() {
  const [schemes, setSchemes] = useState<SchemeMetric[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [styles, setStyles] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [style, setStyle] = useState("");
  const [house, setHouse] = useState("");
  const [minSharpe, setMinSharpe] = useState("");
  const [maxExpense, setMaxExpense] = useState("");
  const [minCagr3y, setMinCagr3y] = useState("");
  const [sort, setSort] = useState("sharpe_3y");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected(loadCompare());
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (house) p.set("house", house);
    if (style) p.set("style", style);
    if (minSharpe) p.set("minSharpe", minSharpe);
    if (maxExpense) p.set("maxExpense", maxExpense);
    if (minCagr3y) p.set("minCagr3y", minCagr3y);
    p.set("sort", sort);
    p.set("order", sort === "expense_ratio" ? "asc" : "desc");
    p.set("limit", "200");
    return p.toString();
  }, [q, house, style, minSharpe, maxExpense, minCagr3y, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/v1/schemes?${query}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) setError(d.error || "Could not load schemes");
          else setError(null);
          setSchemes(d.schemes || []);
          setHouses(d.houses || []);
          setStyles(d.styles || []);
        })
        .catch(() => setError("Could not load schemes"));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= COMPARE_MAX
          ? prev
          : [...prev, code];
      saveCompare(next);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Fund screener</h1>
          <p className="text-sm text-zinc-400">
            Direct Growth active-equity schemes. Filter by category, house, Sharpe, TER, and returns.
            Tick funds here or add them on Compare.
          </p>
        </div>
        <Link
          href={selected.length >= 2 ? `/compare?codes=${selected.join(",")}` : "/compare"}
          className={`rounded border px-3 py-1.5 text-sm ${
            selected.length >= 2
              ? "border-zinc-500 text-zinc-100 hover:bg-zinc-900"
              : "border-zinc-800 text-zinc-600 pointer-events-none"
          }`}
        >
          Compare {selected.length || ""}
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs text-zinc-500 lg:col-span-2">
          Search
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scheme or house"
          />
        </label>
        <label className="text-xs text-zinc-500 lg:col-span-2">
          Category
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            <option value="">All categories</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500 lg:col-span-2">
          Fund house
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={house}
            onChange={(e) => setHouse(e.target.value)}
          >
            <option value="">All houses</option>
            {houses.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Min Sharpe 3Y
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={minSharpe}
            onChange={(e) => setMinSharpe(e.target.value)}
            placeholder="0.5"
            inputMode="decimal"
          />
        </label>
        <label className="text-xs text-zinc-500">
          Max TER %
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={maxExpense}
            onChange={(e) => setMaxExpense(e.target.value)}
            placeholder="1.0"
            inputMode="decimal"
          />
        </label>
        <label className="text-xs text-zinc-500">
          Min CAGR 3Y %
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={minCagr3y}
            onChange={(e) => setMinCagr3y(e.target.value)}
            placeholder="12"
            inputMode="decimal"
          />
        </label>
        <label className="text-xs text-zinc-500">
          Sort
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="sharpe_3y">Sharpe 3Y</option>
            <option value="cagr_3y">CAGR 3Y</option>
            <option value="cagr_5y">CAGR 5Y</option>
            <option value="expense_ratio">Expense (low)</option>
            <option value="aum_cr">AUM</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-sm text-amber-400">
          {error === "supabase_not_configured"
            ? "Supabase is not configured. Add keys, run the scheme_metrics migration, then npm run ingest:metrics."
            : error}
        </p>
      ) : null}
      {!error && schemes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No rows yet. After SQL is applied: <code>npm run ingest:metrics</code>
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-2 font-normal w-8" />
              <th className="py-2 pr-3 font-normal">Scheme</th>
              <th className="py-2 pr-3 font-normal">House</th>
              <th className="py-2 pr-3 font-normal">Category</th>
              <th className="py-2 pr-3 font-normal">Sharpe 3Y</th>
              <th className="py-2 pr-3 font-normal">TER %</th>
              <th className="py-2 pr-3 font-normal">CAGR 1Y</th>
              <th className="py-2 pr-3 font-normal">CAGR 3Y</th>
              <th className="py-2 font-normal">AUM ₹ cr</th>
            </tr>
          </thead>
          <tbody>
            {schemes.map((s) => (
              <tr key={s.scheme_code} className="border-t border-zinc-800">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.scheme_code)}
                    onChange={() => toggle(s.scheme_code)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Link className="hover:underline" href={`/schemes/${s.scheme_code}`}>
                    {s.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-zinc-400">{s.fund_house}</td>
                <td className="py-2 pr-3 text-zinc-400">{s.category}</td>
                <td className="py-2 pr-3">{formatNumber(s.sharpe_3y)}</td>
                <td className="py-2 pr-3">{formatNumber(s.expense_ratio)}</td>
                <td className="py-2 pr-3">{formatNumber(s.cagr_1y)}</td>
                <td className="py-2 pr-3">{formatNumber(s.cagr_3y)}</td>
                <td className="py-2">{formatNumber(s.aum_cr, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

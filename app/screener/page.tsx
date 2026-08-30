"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type SchemeMetric, type SortKey } from "@/lib/scheme-metrics";
import { formatNumber } from "@/lib/format";

const TABLE_COLUMNS = [
  { key: "name", label: "Scheme" },
  { key: "fund_house", label: "House" },
  { key: "category", label: "Category" },
  { key: "sharpe_3y", label: "Sharpe 3Y" },
  { key: "expense_ratio", label: "TER %" },
  { key: "cagr_1y", label: "CAGR 1Y" },
  { key: "cagr_3y", label: "CAGR 3Y" },
  { key: "cagr_inception", label: "CAGR inception" },
  { key: "aum_cr", label: "AUM ₹ cr" },
] as const;

const DEFAULT_VISIBLE_COLUMNS: (typeof TABLE_COLUMNS)[number]["key"][] = [
  "name",
  "sharpe_3y",
  "expense_ratio",
  "cagr_1y",
  "cagr_3y",
  "cagr_inception",
  "aum_cr",
];

export default function ScreenerPage() {
  const [schemes, setSchemes] = useState<SchemeMetric[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [styles, setStyles] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [style, setStyle] = useState("");
  const [house, setHouse] = useState("");
  const [minSharpe, setMinSharpe] = useState("");
  const [maxSharpe, setMaxSharpe] = useState("");
  const [minExpense, setMinExpense] = useState("");
  const [maxExpense, setMaxExpense] = useState("");
  const [minCagr1y, setMinCagr1y] = useState("");
  const [maxCagr1y, setMaxCagr1y] = useState("");
  const [minCagr3y, setMinCagr3y] = useState("");
  const [maxCagr3y, setMaxCagr3y] = useState("");
  const [minCagrInception, setMinCagrInception] = useState("");
  const [maxCagrInception, setMaxCagrInception] = useState("");
  const [minAum, setMinAum] = useState("");
  const [maxAum, setMaxAum] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<(typeof TABLE_COLUMNS)[number]["key"][]>(DEFAULT_VISIBLE_COLUMNS);
  const [sortKey, setSortKey] = useState<SortKey>("sharpe_3y");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (house) p.set("house", house);
    if (style) p.set("style", style);
    if (minSharpe) p.set("minSharpe", minSharpe);
    if (maxSharpe) p.set("maxSharpe", maxSharpe);
    if (minExpense) p.set("minExpense", minExpense);
    if (maxExpense) p.set("maxExpense", maxExpense);
    if (minCagr1y) p.set("minCagr1y", minCagr1y);
    if (maxCagr1y) p.set("maxCagr1y", maxCagr1y);
    if (minCagr3y) p.set("minCagr3y", minCagr3y);
    if (maxCagr3y) p.set("maxCagr3y", maxCagr3y);
    if (minCagrInception) p.set("minCagrInception", minCagrInception);
    if (maxCagrInception) p.set("maxCagrInception", maxCagrInception);
    if (minAum) p.set("minAum", minAum);
    if (maxAum) p.set("maxAum", maxAum);
    p.set("sort", sortKey);
    p.set("order", sortOrder);
    p.set("limit", "200");
    return p.toString();
  }, [q, house, style, minSharpe, maxSharpe, minExpense, maxExpense, minCagr1y, maxCagr1y, minCagr3y, maxCagr3y, minCagrInception, maxCagrInception, minAum, maxAum, sortKey, sortOrder]);

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

  const visibleTableColumns = useMemo<Array<(typeof TABLE_COLUMNS)[number]>>(
    () =>
      visibleColumns
        .map((key) => TABLE_COLUMNS.find((column) => column.key === key))
        .filter((column): column is (typeof TABLE_COLUMNS)[number] => Boolean(column)),
    [visibleColumns]
  );

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "name" || key === "fund_house" ? "asc" : "desc");
  }

  function toggleColumn(key: (typeof TABLE_COLUMNS)[number]["key"]) {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Fund screener</h1>
        <p className="text-sm text-zinc-400">
          Direct Growth active-equity schemes. Filter by fund house, category, risk-adjusted returns,
          expense ratio, and return profile.
        </p>
        <p className="mt-1 text-xs text-zinc-500">Click any column header to sort the table.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Search
              </div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Scheme or house"
              />
            </div>

            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Fund scope
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-zinc-500">
                  Category
                  <select
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
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
                <label className="block text-xs text-zinc-500">
                  Fund house
                  <select
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
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
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Risk / return
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-500">
                  Min Sharpe
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={minSharpe}
                    onChange={(e) => setMinSharpe(e.target.value)}
                    placeholder="0.5"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Max Sharpe
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={maxSharpe}
                    onChange={(e) => setMaxSharpe(e.target.value)}
                    placeholder="1.5"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Min 1Y CAGR
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={minCagr1y}
                    onChange={(e) => setMinCagr1y(e.target.value)}
                    placeholder="8"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Max 1Y CAGR
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={maxCagr1y}
                    onChange={(e) => setMaxCagr1y(e.target.value)}
                    placeholder="20"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Min 3Y CAGR
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={minCagr3y}
                    onChange={(e) => setMinCagr3y(e.target.value)}
                    placeholder="12"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Max 3Y CAGR
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={maxCagr3y}
                    onChange={(e) => setMaxCagr3y(e.target.value)}
                    placeholder="25"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500 col-span-2">
                  Min inception CAGR
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={minCagrInception}
                    onChange={(e) => setMinCagrInception(e.target.value)}
                    placeholder="10"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500 col-span-2">
                  Max inception CAGR
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={maxCagrInception}
                    onChange={(e) => setMaxCagrInception(e.target.value)}
                    placeholder="18"
                    inputMode="decimal"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Cost / scale
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-500">
                  Min TER
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={minExpense}
                    onChange={(e) => setMinExpense(e.target.value)}
                    placeholder="0.4"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Max TER
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={maxExpense}
                    onChange={(e) => setMaxExpense(e.target.value)}
                    placeholder="1.0"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Min AUM
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={minAum}
                    onChange={(e) => setMinAum(e.target.value)}
                    placeholder="500"
                    inputMode="numeric"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Max AUM
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    value={maxAum}
                    onChange={(e) => setMaxAum(e.target.value)}
                    placeholder="50000"
                    inputMode="numeric"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Visible columns
              </div>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {TABLE_COLUMNS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
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

          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    {visibleTableColumns.map((column) => {
                      const isActive = sortKey === column.key;
                      const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
                      return (
                        <th key={column.key} className="py-2 pr-3 font-normal">
                          <button type="button" className="inline-flex items-center gap-1 hover:text-zinc-200" onClick={() => onSort(column.key as SortKey)}>
                            {column.label}
                            <span className={isActive ? "text-zinc-200" : "text-zinc-500"}>{arrow}</span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {schemes.map((s) => (
                    <tr key={s.scheme_code} className="border-t border-zinc-800 align-top">
                      {visibleTableColumns.map((column) => (
                        <td key={`${s.scheme_code}-${column.key}`} className={column.key === "name" ? "py-2 pr-3 align-top" : "py-2 pr-3 align-top text-zinc-400"}>
                          {column.key === "name" ? (
                            <Link
                              className="block max-w-[280px] leading-snug hover:underline"
                              href={`/schemes/${s.scheme_code}`}
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                lineHeight: "1.35",
                                minHeight: "2.7em",
                                maxHeight: "2.7em",
                              }}
                            >
                              {s.name}
                            </Link>
                          ) : column.key === "fund_house" ? (
                            s.fund_house
                          ) : column.key === "category" ? (
                            s.category
                          ) : column.key === "sharpe_3y" ? (
                            formatNumber(s.sharpe_3y)
                          ) : column.key === "expense_ratio" ? (
                            formatNumber(s.expense_ratio)
                          ) : column.key === "cagr_1y" ? (
                            formatNumber(s.cagr_1y)
                          ) : column.key === "cagr_3y" ? (
                            formatNumber(s.cagr_3y)
                          ) : column.key === "cagr_inception" ? (
                            formatNumber(s.cagr_inception)
                          ) : column.key === "aum_cr" ? (
                            formatNumber(s.aum_cr, 0)
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

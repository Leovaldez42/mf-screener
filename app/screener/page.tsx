"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoadingWait } from "@/components/ui";
import { type CategoryAverage, type SchemeMetric, type SortKey } from "@/lib/scheme-metrics";
import { formatNumber } from "@/lib/format";

const TABLE_COLUMNS = [
  { key: "name", label: "Scheme", hide: "" },
  { key: "sharpe_3y", label: "Sharpe 3Y", hide: "" },
  { key: "expense_ratio", label: "TER %", hide: "" },
  { key: "cagr_1y", label: "CAGR 1Y", hide: "hidden sm:table-cell" },
  { key: "cagr_3y", label: "CAGR 3Y", hide: "" },
  { key: "cagr_inception", label: "CAGR inception", hide: "hidden lg:table-cell" },
  { key: "aum_cr", label: "AUM ₹ cr", hide: "hidden sm:table-cell" },
  { key: "fund_house", label: "House", hide: "hidden md:table-cell" },
  { key: "category", label: "Category", hide: "hidden lg:table-cell" },
] as const;

type NumericCol = "sharpe_3y" | "expense_ratio" | "cagr_1y" | "cagr_3y" | "cagr_inception" | "aum_cr";

export default function ScreenerPage() {
  const [schemes, setSchemes] = useState<SchemeMetric[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [styles, setStyles] = useState<{ id: string; label: string }[]>([]);
  const [styleAverage, setStyleAverage] = useState<CategoryAverage | null>(null);
  const [universe, setUniverse] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    p.set("limit", "600");
    return p.toString();
  }, [
    q,
    house,
    style,
    minSharpe,
    maxSharpe,
    minExpense,
    maxExpense,
    minCagr1y,
    maxCagr1y,
    minCagr3y,
    maxCagr3y,
    minCagrInception,
    maxCagrInception,
    minAum,
    maxAum,
    sortKey,
    sortOrder,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/schemes?${query}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) setError(d.error || "Could not load schemes");
          else setError(null);
          setSchemes(d.schemes || []);
          setHouses(d.houses || []);
          setStyles(d.styles || []);
          setStyleAverage(d.styleAverage || null);
          setUniverse(typeof d.universe === "number" ? d.universe : null);
        })
        .catch(() => setError("Could not load schemes"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "name" || key === "fund_house" ? "asc" : "desc");
  }

  const styleLabel = styles.find((s) => s.id === style)?.label || style;
  const strip = style && styleAverage ? styleAverage : null;

  function cell(s: SchemeMetric, key: (typeof TABLE_COLUMNS)[number]["key"]) {
    if (key === "name") {
      return (
        <Link className="block max-w-55 leading-snug hover:underline sm:max-w-70" href={`/schemes/${s.scheme_code}`}>
          {s.name}
        </Link>
      );
    }
    if (key === "fund_house") return s.fund_house;
    if (key === "category") return <span className="text-xs">{s.category}</span>;
    if (key === "aum_cr") return formatNumber(s.aum_cr, 0);
    return formatNumber(s[key as NumericCol]);
  }

  const filterForm = (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Search</div>
        <input
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Scheme or house"
        />
      </div>
      <div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Fund scope</div>
        <div className="space-y-2">
          <label className="block text-xs text-faint">
            Category
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
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
          <label className="block text-xs text-faint">
            Fund house
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
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
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Risk / return</div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Min Sharpe" value={minSharpe} onChange={setMinSharpe} placeholder="0.5" />
          <NumField label="Max Sharpe" value={maxSharpe} onChange={setMaxSharpe} placeholder="1.5" />
          <NumField label="Min 1Y CAGR" value={minCagr1y} onChange={setMinCagr1y} placeholder="8" />
          <NumField label="Max 1Y CAGR" value={maxCagr1y} onChange={setMaxCagr1y} placeholder="20" />
          <NumField label="Min 3Y CAGR" value={minCagr3y} onChange={setMinCagr3y} placeholder="12" />
          <NumField label="Max 3Y CAGR" value={maxCagr3y} onChange={setMaxCagr3y} placeholder="25" />
          <NumField label="Min inception CAGR" value={minCagrInception} onChange={setMinCagrInception} placeholder="10" className="col-span-2" />
          <NumField label="Max inception CAGR" value={maxCagrInception} onChange={setMaxCagrInception} placeholder="18" className="col-span-2" />
        </div>
      </div>
      <div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Cost / scale</div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Min TER" value={minExpense} onChange={setMinExpense} placeholder="0.4" />
          <NumField label="Max TER" value={maxExpense} onChange={setMaxExpense} placeholder="1.0" />
          <NumField label="Min AUM" value={minAum} onChange={setMinAum} placeholder="500" numeric />
          <NumField label="Max AUM" value={maxAum} onChange={setMaxAum} placeholder="50000" numeric />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Fund screener</h1>
        <p className="text-sm text-muted">
          Direct Growth active-equity schemes. Filter by fund house, category, Sharpe, TER, and returns.
          Open a scheme for peer category averages.
        </p>
        <p className="mt-1 text-xs text-faint">
          Click any column header to sort.
          {universe != null ? ` Showing ${schemes.length} of ${universe} schemes.` : null}
        </p>
      </div>

      <button
        type="button"
        className="rounded border border-border px-3 py-1.5 text-sm lg:hidden"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        {filtersOpen ? "Hide filters" : "Show filters"}
      </button>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`rounded border border-border bg-card p-3 ${filtersOpen ? "block" : "hidden"} lg:block`}>
          {filterForm}
        </aside>

        <div className="min-w-0 space-y-4">
          {error ? (
            <p className="text-sm text-amber-400">
              {error === "supabase_not_configured"
                ? "Supabase is not configured. Add keys, run the scheme_metrics migration, then npm run ingest:metrics."
                : error}
            </p>
          ) : null}
          {!error && loading ? <LoadingWait label="Loading schemes…" /> : null}
          {!error && !loading && schemes.length === 0 ? (
            <p className="text-sm text-faint">
              No rows yet. After SQL is applied: <code>npm run ingest:metrics</code>
            </p>
          ) : null}

          {strip ? (
            <div className="rounded border border-border bg-card px-3 py-2 text-sm">
              <div className="font-medium text-foreground">
                {styleLabel} · {strip.n} funds (equal-weight avg)
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>Sharpe 3Y {formatNumber(strip.sharpe_3y)}</span>
                <span>TER {formatNumber(strip.expense_ratio)}%</span>
                <span>CAGR 3Y {formatNumber(strip.cagr_3y)}%</span>
                <span>CAGR 1Y {formatNumber(strip.cagr_1y)}%</span>
              </div>
            </div>
          ) : null}

          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-sm">
              <thead className="text-faint">
                <tr>
                  {TABLE_COLUMNS.map((column) => {
                    const isActive = sortKey === column.key;
                    const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
                    return (
                      <th
                        key={column.key}
                        className={`py-2 pr-3 font-normal ${column.hide} ${column.key === "name" ? "sticky left-0 z-10 bg-background" : ""}`}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => onSort(column.key as SortKey)}
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
                {schemes.map((s) => (
                  <tr key={s.scheme_code} className="border-t border-border align-top">
                    {TABLE_COLUMNS.map((column) => (
                      <td
                        key={`${s.scheme_code}-${column.key}`}
                        className={`py-2 pr-3 align-top ${column.hide} ${
                          column.key === "name" ? "sticky left-0 z-10 bg-background" : "text-muted"
                        }`}
                      >
                        {cell(s, column.key)}
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
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <label className={`text-xs text-faint ${className}`}>
      {label}
      <input
        className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "numeric" : "decimal"}
      />
    </label>
  );
}

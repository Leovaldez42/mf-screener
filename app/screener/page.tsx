"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoadError, TableSkeleton, UpdatingNote } from "@/components/load-ui";
import {
  CLASS_TABS,
  assetClassMeta,
  classShowsPe,
  classTabMeta,
  DEFAULT_ASSET_CLASS,
  parseAssetClass,
  type ClassTabId,
} from "@/lib/fund-class";
import { type CategoryAverage, type SchemeMetric, type SortKey } from "@/lib/scheme-metrics";
import { formatNumber } from "@/lib/format";

type TableCol = { key: SortKey; label: string; hide: string };

const EQUITY_COLUMNS: TableCol[] = [
  { key: "name", label: "Scheme", hide: "" },
  { key: "sharpe_3y", label: "Sharpe 3Y", hide: "" },
  { key: "pe", label: "PE", hide: "hidden sm:table-cell" },
  { key: "expense_ratio", label: "TER %", hide: "" },
  { key: "cagr_1y", label: "CAGR 1Y", hide: "hidden sm:table-cell" },
  { key: "cagr_3y", label: "CAGR 3Y", hide: "" },
  { key: "cagr_inception", label: "CAGR inception", hide: "hidden lg:table-cell" },
  { key: "aum_cr", label: "AUM ₹ cr", hide: "hidden sm:table-cell" },
];

const TER_COLUMNS: TableCol[] = [
  { key: "name", label: "Scheme", hide: "" },
  { key: "expense_ratio", label: "TER %", hide: "" },
  { key: "sharpe_3y", label: "Sharpe 3Y", hide: "hidden sm:table-cell" },
  { key: "cagr_1y", label: "CAGR 1Y", hide: "hidden sm:table-cell" },
  { key: "cagr_3y", label: "CAGR 3Y", hide: "" },
  { key: "cagr_inception", label: "CAGR inception", hide: "hidden lg:table-cell" },
  { key: "aum_cr", label: "AUM ₹ cr", hide: "hidden sm:table-cell" },
];

function columnsForClass(tab: ClassTabId): TableCol[] {
  if (tab === "all") return TER_COLUMNS;
  return classShowsPe(tab) ? EQUITY_COLUMNS : TER_COLUMNS;
}

type NumericCol = "sharpe_3y" | "pe" | "expense_ratio" | "cagr_1y" | "cagr_3y" | "cagr_inception" | "aum_cr";

export default function ScreenerPage() {
  const [schemes, setSchemes] = useState<SchemeMetric[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [styles, setStyles] = useState<{ id: string; label: string }[]>([]);
  const [styleAverage, setStyleAverage] = useState<CategoryAverage | null>(null);
  const [universe, setUniverse] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [reload, setReload] = useState(0);
  const [assetClass, setAssetClass] = useState<ClassTabId>(DEFAULT_ASSET_CLASS);
  const [q, setQ] = useState("");
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [house, setHouse] = useState("");
  const [minSharpe, setMinSharpe] = useState("");
  const [maxExpense, setMaxExpense] = useState("");
  const [maxPe, setMaxPe] = useState("");
  const [minCagr1y, setMinCagr1y] = useState("");
  const [minCagr3y, setMinCagr3y] = useState("");
  const [minCagrInception, setMinCagrInception] = useState("");
  const [minAum, setMinAum] = useState("");
  const [maxAum, setMaxAum] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sharpe_3y");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const hasRows = useRef(false);
  const browseAll = assetClass === "all";
  const showPe = browseAll || classShowsPe(assetClass);
  const searching = q.trim().length > 0;
  const tableColumns = browseAll || searching ? TER_COLUMNS : columnsForClass(assetClass);

  function changeClass(next: ClassTabId) {
    const meta = classTabMeta(next);
    setAssetClass(next);
    setQ("");
    setStyleIds([]);
    setHouse("");
    setMaxPe("");
    setSortKey(meta.defaultSort as SortKey);
    setSortOrder(meta.defaultOrder);
    hasRows.current = false;
  }

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("class", assetClass);
    if (q) p.set("q", q);
    if (house) p.set("house", house);
    if (styleIds.length) p.set("style", styleIds.join(","));
    if (minSharpe) p.set("minSharpe", minSharpe);
    if (maxExpense) p.set("maxExpense", maxExpense);
    if (maxPe) p.set("maxPe", maxPe);
    if (minCagr1y) p.set("minCagr1y", minCagr1y);
    if (minCagr3y) p.set("minCagr3y", minCagr3y);
    if (minCagrInception) p.set("minCagrInception", minCagrInception);
    if (minAum) p.set("minAum", minAum);
    if (maxAum) p.set("maxAum", maxAum);
    p.set("sort", sortKey);
    p.set("order", sortOrder);
    p.set("limit", "600");
    return p.toString();
  }, [
    assetClass,
    q,
    house,
    styleIds,
    minSharpe,
    maxExpense,
    maxPe,
    minCagr1y,
    minCagr3y,
    minCagrInception,
    minAum,
    maxAum,
    sortKey,
    sortOrder,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (hasRows.current) setUpdating(true);
      else setLoading(true);
      fetch(`/api/v1/schemes?${query}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) {
            setError(d.error || "Could not load schemes");
            return;
          }
          setError(null);
          const next = (d.schemes || []) as SchemeMetric[];
          setSchemes(next);
          hasRows.current = next.length > 0;
          setHouses(d.houses || []);
          setStyles(d.styles || []);
          setStyleAverage(d.styleAverage || null);
          setUniverse(typeof d.universe === "number" ? d.universe : null);
        })
        .catch(() => {
          if (!hasRows.current) setError("Could not load schemes");
        })
        .finally(() => {
          setLoading(false);
          setUpdating(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [query, reload]);

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "name" || key === "fund_house" || key === "expense_ratio" ? "asc" : "desc");
  }

  const styleLabel = styleIds
    .map((id) => styles.find((s) => s.id === id)?.label || id)
    .join(" · ");
  const strip = !searching && styleIds.length && styleAverage ? styleAverage : null;
  const classLabel = classTabMeta(assetClass).label;
  const showClassOnRow = searching || browseAll;

  function cell(s: SchemeMetric, key: SortKey) {
    if (key === "name") {
      return (
        <>
          <Link className="block max-w-55 leading-snug hover:underline sm:max-w-70" href={`/schemes/${s.scheme_code}`}>
            {s.name}
          </Link>
          {showClassOnRow ? (
            <div className="mt-0.5 text-xs text-faint">{assetClassMeta(parseAssetClass(s.asset_class)).label}</div>
          ) : null}
        </>
      );
    }
    if (key === "aum_cr") return formatNumber(s.aum_cr, 0);
    if (key === "fund_house") return s.fund_house;
    return formatNumber(s[key as NumericCol]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-medium">Fund screener</h1>
        {updating ? <UpdatingNote /> : null}
      </div>

      <div className="-mx-4 overflow-x-auto border-b border-border px-4 scrollbar-none sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Fund class">
          {CLASS_TABS.map((c) => {
            const selected = assetClass === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm ${
                  selected
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
                onClick={() => changeClass(c.id)}
              >
                <span className="sm:hidden">{c.short}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-44 rounded border border-border bg-input px-2.5 text-sm sm:w-56"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or ticker"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {searching ? (
          <button
            type="button"
            className="h-9 shrink-0 px-1 text-sm text-muted underline hover:text-foreground"
            onClick={() => setQ("")}
          >
            Clear
          </button>
        ) : (
          <select
            className="h-9 max-w-full rounded border border-border bg-input px-2 text-sm sm:max-w-52"
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            aria-label="Fund house"
          >
            <option value="">All houses</option>
            {houses.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        )}
      </div>

      {!searching && styles.length ? (
        <StyleFilters styles={styles} selected={styleIds} onChange={setStyleIds} />
      ) : null}

      {searching ? (
        <p className="text-xs text-faint">
          {schemes.length} matches{browseAll ? "" : " across classes"} for “{q.trim()}”.
        </p>
      ) : null}

      <div className="flex gap-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 rounded-lg border border-border bg-surface p-3">
            <div className="mb-3 text-sm font-medium text-foreground">Filters</div>
            <NumberFilters
              minSharpe={minSharpe}
              setMinSharpe={setMinSharpe}
              minCagr1y={minCagr1y}
              setMinCagr1y={setMinCagr1y}
              minCagr3y={minCagr3y}
              setMinCagr3y={setMinCagr3y}
              minCagrInception={minCagrInception}
              setMinCagrInception={setMinCagrInception}
              maxExpense={maxExpense}
              setMaxExpense={setMaxExpense}
              maxPe={maxPe}
              setMaxPe={setMaxPe}
              minAum={minAum}
              setMinAum={setMinAum}
              maxAum={maxAum}
              setMaxAum={setMaxAum}
            />
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="rounded-lg border border-border bg-surface p-3 lg:hidden">
            <div className="mb-3 text-sm font-medium text-foreground">Filters</div>
            <NumberFilters
              compact
              minSharpe={minSharpe}
              setMinSharpe={setMinSharpe}
              minCagr1y={minCagr1y}
              setMinCagr1y={setMinCagr1y}
              minCagr3y={minCagr3y}
              setMinCagr3y={setMinCagr3y}
              minCagrInception={minCagrInception}
              setMinCagrInception={setMinCagrInception}
              maxExpense={maxExpense}
              setMaxExpense={setMaxExpense}
              maxPe={maxPe}
              setMaxPe={setMaxPe}
              minAum={minAum}
              setMinAum={setMinAum}
              maxAum={maxAum}
              setMaxAum={setMaxAum}
            />
          </div>
          {!searching && universe != null ? (
            <p className="text-xs text-faint">
              {schemes.length} of {universe}
              {browseAll ? "" : ` ${classLabel.toLowerCase()}`} schemes
            </p>
          ) : null}

      {error ? (
        <LoadError
          message={
            error === "supabase_not_configured"
              ? "Supabase is not configured. Add keys, run the scheme_metrics migrations, then npm run ingest:metrics."
              : error
          }
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}
      {loading && schemes.length === 0 ? (
        <TableSkeleton columns={tableColumns.map((c) => ({ label: c.label, hide: c.hide }))} rows={12} />
      ) : null}
      {!loading && !error && schemes.length === 0 ? (
        <p className="text-sm text-faint">
          {searching ? "No schemes match that search." : "No schemes in this slice. Try All, or another class."}
        </p>
      ) : null}

      {strip ? (
        <div className="rounded border border-border bg-card px-3 py-2 text-sm">
          <div className="font-medium text-foreground">
            {styleLabel} · {strip.n} funds (equal-weight avg)
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>Sharpe 3Y {formatNumber(strip.sharpe_3y)}</span>
            {showPe ? <span>PE {formatNumber(strip.pe)}</span> : null}
            <span>TER {formatNumber(strip.expense_ratio)}%</span>
            <span>CAGR 3Y {formatNumber(strip.cagr_3y)}%</span>
            <span>CAGR 1Y {formatNumber(strip.cagr_1y)}%</span>
          </div>
        </div>
      ) : null}

      {schemes.length > 0 ? (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead className="text-faint">
              <tr>
                {tableColumns.map((column) => {
                  const isActive = sortKey === column.key;
                  const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
                  const isName = column.key === "name";
                  return (
                    <th
                      key={column.key}
                      className={`py-2 pr-3 font-normal ${column.hide} ${
                        isName ? "sticky left-0 z-10 bg-background text-left" : "text-center"
                      }`}
                    >
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 hover:text-foreground ${isName ? "" : "justify-center"}`}
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
              {schemes.map((s) => (
                <tr key={s.scheme_code} className="border-t border-border align-top">
                  {tableColumns.map((column) => {
                    const isName = column.key === "name";
                    return (
                      <td
                        key={`${s.scheme_code}-${column.key}`}
                        className={`py-2 pr-3 align-top ${column.hide} ${
                          isName ? "sticky left-0 z-10 bg-background text-left" : "text-center text-muted"
                        }`}
                      >
                        {cell(s, column.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}

function NumberFilters({
  compact = false,
  minSharpe,
  setMinSharpe,
  minCagr1y,
  setMinCagr1y,
  minCagr3y,
  setMinCagr3y,
  minCagrInception,
  setMinCagrInception,
  maxExpense,
  setMaxExpense,
  maxPe,
  setMaxPe,
  minAum,
  setMinAum,
  maxAum,
  setMaxAum,
}: {
  compact?: boolean;
  minSharpe: string;
  setMinSharpe: (v: string) => void;
  minCagr1y: string;
  setMinCagr1y: (v: string) => void;
  minCagr3y: string;
  setMinCagr3y: (v: string) => void;
  minCagrInception: string;
  setMinCagrInception: (v: string) => void;
  maxExpense: string;
  setMaxExpense: (v: string) => void;
  maxPe: string;
  setMaxPe: (v: string) => void;
  minAum: string;
  setMinAum: (v: string) => void;
  maxAum: string;
  setMaxAum: (v: string) => void;
}) {
  const fields = (
    <>
      <NumField label="Min Sharpe" value={minSharpe} onChange={setMinSharpe} />
      <NumField label="Min 1Y CAGR" value={minCagr1y} onChange={setMinCagr1y} />
      <NumField label="Min 3Y CAGR" value={minCagr3y} onChange={setMinCagr3y} />
      <NumField label="Min inception CAGR" value={minCagrInception} onChange={setMinCagrInception} />
      <NumField label="Max TER" value={maxExpense} onChange={setMaxExpense} />
      <NumField label="Max PE" value={maxPe} onChange={setMaxPe} />
      <NumField label="Min AUM" value={minAum} onChange={setMinAum} numeric />
      <NumField label="Max AUM" value={maxAum} onChange={setMaxAum} numeric />
    </>
  );
  if (compact) {
    return <div className="grid grid-cols-2 gap-2">{fields}</div>;
  }
  return <div className="space-y-2">{fields}</div>;
}

function StyleFilters({
  styles,
  selected,
  onChange,
  stacked = false,
  className = "",
}: {
  styles: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  stacked?: boolean;
  className?: string;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  const clear =
    selected.length > 0 ? (
      <button
        type="button"
        className="px-1 text-xs text-muted underline hover:text-foreground"
        onClick={() => onChange([])}
      >
        Clear
      </button>
    ) : null;

  if (stacked) {
    return (
      <div className={className}>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Category</div>
        <div className="space-y-0.5">
          {styles.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                  on ? "bg-foreground text-background" : "text-muted hover:text-foreground"
                }`}
                onClick={() => toggle(s.id)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {clear ? <div className="mt-2">{clear}</div> : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {styles.map((s) => (
        <Chip key={s.id} on={selected.includes(s.id)} onClick={() => toggle(s.id)}>
          {s.label}
        </Chip>
      ))}
      {clear}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs ${
        on ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
  className = "",
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <label className={`text-xs text-faint ${className}`}>
      {label}
      <input
        className="mt-1 w-full rounded border border-border bg-input px-2 py-1.5 text-sm text-foreground placeholder:text-faint"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Any"
        inputMode={numeric ? "numeric" : "decimal"}
      />
    </label>
  );
}

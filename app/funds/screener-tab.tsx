"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoadError, TableSkeleton, UpdatingNote } from "@/components/load-ui";
import {
  CLASS_TABS,
  DEFAULT_ASSET_CLASS,
  classTabMeta,
  parseStyleIds,
  type ClassTabId,
} from "@/lib/fund-class";
import { fundsHubPath, parseCsvIds, shortCategoryLabel, shortFundLabel } from "@/lib/funds-hub";
import { type CategoryAverage, COMPARE_MAX, SORTABLE, type SchemeMetric, type SortKey } from "@/lib/scheme-metrics";
import { DataAsOfNote } from "@/components/ui";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 8;
const SELECT_MAX = 3;
const OVERLAP_MAX = 3;

const TABLE_COLS: { key: SortKey; label: string; hide: string }[] = [
  { key: "name", label: "Fund", hide: "" },
  { key: "aum_cr", label: "AUM ₹ cr", hide: "" },
  { key: "cagr_1y", label: "1Y", hide: "hidden sm:table-cell" },
  { key: "cagr_3y", label: "3Y", hide: "" },
  { key: "cagr_5y", label: "5Y", hide: "hidden md:table-cell" },
  { key: "expense_ratio", label: "Expense ratio", hide: "" },
];

function isSortKey(value: string): value is SortKey {
  return (SORTABLE as readonly string[]).includes(value);
}

function isClassTab(value: string): value is ClassTabId {
  return CLASS_TABS.some((c) => c.id === value);
}

export function ScreenerTab({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const start = useMemo(() => new URLSearchParams(initialSearch), [initialSearch]);
  const initialClass = isClassTab(start.get("class") || "") ? (start.get("class") as ClassTabId) : DEFAULT_ASSET_CLASS;
  const [schemes, setSchemes] = useState<SchemeMetric[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [styles, setStyles] = useState<{ id: string; label: string }[]>([]);
  const [styleAverage, setStyleAverage] = useState<CategoryAverage | null>(null);
  const [universe, setUniverse] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [reload, setReload] = useState(0);
  const [assetClass, setAssetClass] = useState<ClassTabId>(initialClass);
  const [q, setQ] = useState(start.get("q") || "");
  const [styleIds, setStyleIds] = useState<string[]>(parseStyleIds(start.get("style")));
  const [house, setHouse] = useState(start.get("house") || "");
  const [minSharpe, setMinSharpe] = useState(start.get("minSharpe") || "");
  const [maxExpense, setMaxExpense] = useState(start.get("maxExpense") || "");
  const [maxPe, setMaxPe] = useState(start.get("maxPe") || "");
  const [minCagr1y, setMinCagr1y] = useState(start.get("minCagr1y") || "");
  const [minCagr3y, setMinCagr3y] = useState(start.get("minCagr3y") || "");
  const [minCagrInception, setMinCagrInception] = useState(start.get("minCagrInception") || "");
  const [minAum, setMinAum] = useState(start.get("minAum") || "");
  const [maxAum, setMaxAum] = useState(start.get("maxAum") || "");
  const [sortKey, setSortKey] = useState<SortKey>(isSortKey(start.get("sort") || "") ? (start.get("sort") as SortKey) : "aum_cr");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(start.get("order") === "asc" ? "asc" : "desc");
  const [showAll, setShowAll] = useState(start.get("showAll") === "1");
  const [page, setPage] = useState(Math.max(1, Number(start.get("page") || "1") || 1));
  const [hiddenCount, setHiddenCount] = useState(0);
  const [selected, setSelected] = useState<string[]>(() => parseCsvIds(start.get("funds"), SELECT_MAX));
  const hasRows = useRef(false);
  const skipUrl = useRef(true);
  const searching = q.trim().length > 0;
  const classMeta = classTabMeta(assetClass);

  function changeClass(next: ClassTabId) {
    const meta = classTabMeta(next);
    setAssetClass(next);
    setStyleIds([]);
    setHouse("");
    setMaxPe("");
    setSortKey(next === DEFAULT_ASSET_CLASS ? "aum_cr" : (meta.defaultSort as SortKey));
    setSortOrder(next === DEFAULT_ASSET_CLASS ? "desc" : meta.defaultOrder);
    setPage(1);
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
    if (showAll) p.set("showAll", "1");
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
    showAll,
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
          setHiddenCount(typeof d.hiddenCount === "number" ? d.hiddenCount : 0);
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

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(schemes.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [schemes.length, page]);

  useEffect(() => {
    if (skipUrl.current) {
      skipUrl.current = false;
      return;
    }
    const p = new URLSearchParams();
    if (assetClass !== DEFAULT_ASSET_CLASS) p.set("class", assetClass);
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
    if (sortKey !== "aum_cr") p.set("sort", sortKey);
    if (sortOrder !== "desc") p.set("order", sortOrder);
    if (showAll) p.set("showAll", "1");
    if (page > 1) p.set("page", String(page));
    router.replace(fundsHubPath("screener", p), { scroll: false });
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
    showAll,
    page,
    router,
  ]);

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "name" || key === "fund_house" || key === "expense_ratio" ? "asc" : "desc");
    setPage(1);
  }

  function toggleSelected(code: string) {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= SELECT_MAX) return prev;
      return [...prev, code];
    });
  }

  const categoryValue = styleIds[0] ? `${assetClass}:${styleIds[0]}` : assetClass;
  const styleOptions = assetClass === "all" ? [] : styles.length ? styles : [];
  const styleLabel = styleIds.map((id) => styles.find((s) => s.id === id)?.label || id).join(" · ");
  const strip = !searching && styleIds.length && styleAverage ? styleAverage : null;
  const total = schemes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = schemes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  const countLabel = universe != null ? Math.max(universe, total) : total;
  const selectedFunds = selected.join(",");

  function onCategoryChange(value: string) {
    const [cls, style] = value.split(":");
    if (!isClassTab(cls)) return;
    if (style) {
      setAssetClass(cls);
      setStyleIds([style]);
      setPage(1);
      return;
    }
    changeClass(cls);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-input px-3 text-sm">
          <span className="text-faint">Category</span>
          <select
            className="max-w-40 bg-transparent text-foreground outline-none sm:max-w-52"
            value={categoryValue}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Category"
          >
            {CLASS_TABS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === "equity-active" ? "All equity" : c.label}
              </option>
            ))}
            {styleOptions.map((s) => (
              <option key={`${assetClass}:${s.id}`} value={`${assetClass}:${s.id}`}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-input px-3 text-sm">
          <span className="text-faint">Fund house</span>
          <select
            className="max-w-36 bg-transparent text-foreground outline-none sm:max-w-48"
            value={house}
            onChange={(e) => {
              setHouse(e.target.value);
              setPage(1);
            }}
            aria-label="Fund house"
          >
            <option value="">All{houses.length ? ` ${houses.length}` : ""}</option>
            {houses.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={!showAll}
          onClick={() => {
            setShowAll((v) => !v);
            setPage(1);
          }}
          className={`inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm ${
            !showAll ? "border-accent/40 bg-accent/10 text-foreground" : "border-border text-muted hover:text-foreground"
          }`}
        >
          Direct · Growth
          {!showAll ? <span aria-hidden>×</span> : null}
        </button>
        <input
          className="h-9 min-w-40 flex-1 rounded-full border border-border bg-input px-3 text-sm sm:max-w-72"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by fund name…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="ml-auto text-sm tabular-nums text-muted">{countLabel} funds</p>
        {updating ? <UpdatingNote /> : null}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-faint hover:text-foreground">More filters</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumField label="Min Sharpe" value={minSharpe} onChange={(v) => { setMinSharpe(v); setPage(1); }} />
          <NumField label="Min 1Y CAGR" value={minCagr1y} onChange={(v) => { setMinCagr1y(v); setPage(1); }} />
          <NumField label="Min 3Y CAGR" value={minCagr3y} onChange={(v) => { setMinCagr3y(v); setPage(1); }} />
          <NumField label="Min inception CAGR" value={minCagrInception} onChange={(v) => { setMinCagrInception(v); setPage(1); }} />
          <NumField label="Max TER" value={maxExpense} onChange={(v) => { setMaxExpense(v); setPage(1); }} />
          <NumField label="Max PE" value={maxPe} onChange={(v) => { setMaxPe(v); setPage(1); }} />
          <NumField label="Min AUM" value={minAum} onChange={(v) => { setMinAum(v); setPage(1); }} numeric />
          <NumField label="Max AUM" value={maxAum} onChange={(v) => { setMaxAum(v); setPage(1); }} numeric />
        </div>
      </details>

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

      {strip ? (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
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

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Screener</span>
            {sortKey === "aum_cr" ? " · sorted by AUM" : ` · sorted by ${TABLE_COLS.find((c) => c.key === sortKey)?.label || sortKey}`}
          </p>
        </div>
        {loading && schemes.length === 0 ? (
          <div className="px-4 pb-4">
            <TableSkeleton columns={TABLE_COLS.map((c) => ({ label: c.label, hide: c.hide }))} rows={8} />
          </div>
        ) : null}
        {!loading && !error && schemes.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-faint">
            {searching ? "No schemes match that search." : "No schemes in this slice. Try another category."}
          </p>
        ) : null}
        {schemes.length > 0 ? (
          <div className="-mx-px overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="text-muted">
                <tr className="border-t border-border">
                  <th className="w-10 px-3 py-2 font-normal" />
                  <th className="py-2 pr-3 text-left font-normal">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort("name")}>
                      Fund
                      <span className={sortKey === "name" ? "text-foreground" : "text-faint"}>{sortKey === "name" ? (sortOrder === "desc" ? "↓" : "↑") : ""}</span>
                    </button>
                  </th>
                  <th className="hidden py-2 pr-3 text-left font-normal sm:table-cell">Category</th>
                  {TABLE_COLS.filter((c) => c.key !== "name").map((column) => {
                    const isActive = sortKey === column.key;
                    return (
                      <th key={column.key} className={`py-2 pr-3 text-right font-normal ${column.hide}`}>
                        <button type="button" className="inline-flex items-center justify-end gap-1 hover:text-foreground" onClick={() => onSort(column.key)}>
                          {column.label}
                          <span className={isActive ? "text-foreground" : "text-faint"}>{isActive ? (sortOrder === "desc" ? "↓" : "↑") : ""}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => {
                  const checked = selected.includes(s.scheme_code);
                  return (
                    <tr key={s.scheme_code} className="border-t border-border align-middle">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && selected.length >= SELECT_MAX}
                          onChange={() => toggleSelected(s.scheme_code)}
                          aria-label={`Select ${shortFundLabel(s.name)}`}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <Link className="font-medium hover:underline" href={`/funds/${s.scheme_code}`}>
                          {shortFundLabel(s.name)}
                        </Link>
                        <div className="text-xs text-faint">{s.fund_house}</div>
                      </td>
                      <td className="hidden py-3 pr-3 sm:table-cell">
                        <span className="inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted">
                          {shortCategoryLabel(s.category)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-muted">{formatNumber(s.aum_cr, 0)}</td>
                      <td className="hidden py-3 pr-3 text-right tabular-nums text-muted sm:table-cell">{formatNumber(s.cagr_1y)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-muted">{formatNumber(s.cagr_3y)}</td>
                      <td className="hidden py-3 pr-3 text-right tabular-nums text-muted md:table-cell">{formatNumber(s.cagr_5y)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-muted">{formatNumber(s.expense_ratio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {schemes.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted">
            <p>
              Showing {from}–{to} of {total} funds
              {classMeta.id === DEFAULT_ASSET_CLASS && !showAll ? " · Direct plan · Growth" : null}
              {" · "}
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setPage(1); }} />
                Show all plans{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
              </label>
              {pageRows.some((s) => s.inception_cagr_reliable === false) ? (
                <span title="Vendor inception CAGR looks wrong, hidden"> · Some inception CAGRs flagged as unreliable</span>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              <DataAsOfNote variant="returns" />
              <button
                type="button"
                className="h-8 rounded-md border border-border px-2 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <button
                type="button"
                className="h-8 rounded-md border border-border px-2 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selected.length >= 2 ? (
        <div className="sticky bottom-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <p className="text-sm">
            {selected.length} fund{selected.length === 1 ? "" : "s"} selected
            {selected.length > COMPARE_MAX ? ` (compare uses the first ${COMPARE_MAX})` : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg"
              href={fundsHubPath("compare", { funds: selectedFunds })}
            >
              Compare
            </Link>
            <Link
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-surface"
              href={fundsHubPath("overlap", { funds: selected.slice(0, OVERLAP_MAX).join(",") })}
            >
              Check overlap
            </Link>
            <button type="button" className="text-sm text-muted underline hover:text-foreground" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input
        className="mt-1 w-full rounded border border-border bg-input px-2 py-1.5 text-sm text-foreground placeholder:text-faint"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="All"
        inputMode={numeric ? "numeric" : "decimal"}
      />
    </label>
  );
}

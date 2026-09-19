"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";

export type FundSector = { name: string; weight_pct: number };

const OVERVIEW_TOP = 8;
const CASH_EPS = 0.05;

/** Categorical hues — a bit more chroma than zinc, still not neon. */
const SWATCHES = [
  "color-mix(in srgb, #4f7fd4 88%, var(--muted))",
  "color-mix(in srgb, #2a9d8f 86%, var(--muted))",
  "color-mix(in srgb, #d4a017 84%, var(--muted))",
  "color-mix(in srgb, #d45a72 86%, var(--muted))",
  "color-mix(in srgb, #7c5cbf 86%, var(--muted))",
  "color-mix(in srgb, #3d9a58 86%, var(--muted))",
  "color-mix(in srgb, #2f8fb8 88%, var(--muted))",
  "color-mix(in srgb, #d46b2c 84%, var(--muted))",
  "color-mix(in srgb, #b04d9e 86%, var(--muted))",
  "color-mix(in srgb, #5aa35a 86%, var(--muted))",
];

const CASH_SWATCH = "color-mix(in srgb, var(--faint) 55%, var(--border))";
const OTHER_SWATCH = "color-mix(in srgb, var(--faint) 40%, var(--surface))";

function swatchFor(i: number) {
  return SWATCHES[((i % SWATCHES.length) + SWATCHES.length) % SWATCHES.length];
}

function pct(n: number) {
  return `${formatNumber(n, 1)}%`;
}

export function FundSectorMap({ sectors }: { sectors: FundSector[] }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"weight" | "name">("weight");

  function close() {
    setOpen(false);
    setQ("");
    setSort("weight");
  }

  const model = useMemo(() => {
    const sorted = [...sectors].sort((a, b) => b.weight_pct - a.weight_pct || a.name.localeCompare(b.name, "en-IN"));
    const equity = sorted.reduce((sum, s) => sum + s.weight_pct, 0);
    const cash = Math.max(0, 100 - equity);
    const top = sorted.slice(0, OVERVIEW_TOP);
    const rest = sorted.slice(OVERVIEW_TOP);
    const restWeight = rest.reduce((sum, s) => sum + s.weight_pct, 0);
    const colorByName = new Map(sorted.map((s, i) => [s.name, swatchFor(i)]));
    return { sorted, equity, cash, top, rest, restWeight, colorByName };
  }, [sectors]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { sorted, equity, cash, top, rest, restWeight, colorByName } = model;
  const showCash = cash >= CASH_EPS;

  const sheetRows = useMemo(() => {
    const rows: { name: string; weight_pct: number; swatch: string }[] = sorted.map((s) => ({
      ...s,
      swatch: colorByName.get(s.name) || swatchFor(0),
    }));
    if (showCash) rows.push({ name: "Cash & others", weight_pct: cash, swatch: CASH_SWATCH });
    const needle = q.trim().toLowerCase();
    const filtered = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;
    const next = [...filtered];
    if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name, "en-IN"));
    else next.sort((a, b) => b.weight_pct - a.weight_pct || a.name.localeCompare(b.name, "en-IN"));
    return next;
  }, [sorted, colorByName, showCash, cash, q, sort]);

  if (!sectors.length) return null;

  return (
    <section className="space-y-3" aria-label="Sector weights">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Sectors</h2>
        <p className="text-sm text-muted">
          Equity {pct(equity)}
          {showCash ? ` · Cash & others ${pct(cash)}` : null}
          {" · "}
          Total 100%
        </p>
      </div>
      <p className="text-xs text-faint">Top holdings by weight — not the full book.</p>

      <div className="space-y-2">
        {top.map((s) => (
          <SectorBar
            key={s.name}
            name={s.name}
            weight={s.weight_pct}
            swatch={colorByName.get(s.name) || swatchFor(0)}
          />
        ))}
        {rest.length > 0 ? (
          <SectorBar
            name={`Other equity · ${rest.length} sector${rest.length === 1 ? "" : "s"}`}
            weight={restWeight}
            swatch={OTHER_SWATCH}
          />
        ) : null}
        {showCash ? <SectorBar name="Cash & others" weight={cash} swatch={CASH_SWATCH} /> : null}
      </div>

      <button
        type="button"
        className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        View all sectors
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-background/75"
            aria-label="Close sector list"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-lg border border-border bg-card shadow-lg md:inset-auto md:left-1/2 md:top-1/2 md:h-auto md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:max-h-[80vh]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 id={titleId} className="text-base font-medium text-foreground">
                  All sectors
                </h3>
                <p className="mt-0.5 text-xs text-faint">Every industry in this book, plus cash if any.</p>
              </div>
              <button
                type="button"
                autoFocus
                className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
                onClick={close}
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
              <input
                className="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by name"
                aria-label="Filter sectors"
              />
              <select
                className="rounded border border-border bg-input px-2 py-1 text-sm"
                value={sort}
                onChange={(e) => setSort(e.target.value as "weight" | "name")}
                aria-label="Sort sectors"
              >
                <option value="weight">Weight</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {sheetRows.length === 0 ? (
                <p className="text-sm text-faint">No sectors match.</p>
              ) : (
                sheetRows.map((s) => (
                  <SectorBar key={s.name} name={s.name} weight={s.weight_pct} swatch={s.swatch} />
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SectorBar({ name, weight, swatch }: { name: string; weight: number; swatch: string }) {
  const width = `${Math.min(100, Math.max(0, weight))}%`;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: swatch }} aria-hidden />
      <span className="min-w-0 max-w-[42%] shrink leading-snug text-foreground">{name}</span>
      <div className="h-1.5 min-w-8 flex-1 rounded bg-surface">
        <div className="h-1.5 rounded" style={{ width, background: swatch }} />
      </div>
      <span className="min-w-12 shrink-0 text-right tabular-nums text-muted">{pct(weight)}</span>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AddsCutsLink } from "@/components/adds-cuts-link";
import { PrefetchHome } from "@/components/prefetch-home";
import { getChaseRows, getHoldingsCoverage, resolveHoldingsMonth } from "@/lib/cached-holdings";
import { formatMonthLabel, formatMonthShort, formatCompactShares } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabase";
import type { ChaseRow } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: "Thinkbrew",
  },
  description:
    "See what Indian active-equity mutual funds bought and sold last month. Adds and cuts, fund screener, and compare. Not investment advice.",
};

type Preview = {
  month: string;
  inflows: ChaseRow[];
  outflows: ChaseRow[];
  coveragePct: number | null;
  coverageHave: number | null;
  coverageTotal: number | null;
};

async function loadPreview(): Promise<Preview | null> {
  if (!supabaseConfigured()) return null;
  try {
    const month = await resolveHoldingsMonth(null);
    if (!month) return null;
    const [rows, coverage] = await Promise.all([getChaseRows(month), getHoldingsCoverage(month)]);
    if (!rows.length) return null;
    const inflows = [...rows]
      .filter((r) => r.net_value_delta_cr > 0)
      .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr)
      .slice(0, 3);
    const outflows = [...rows]
      .filter((r) => r.net_value_delta_cr < 0)
      .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr)
      .slice(0, 3);
    if (!inflows.length && !outflows.length) return null;
    return {
      month,
      inflows,
      outflows,
      coveragePct: coverage.total > 0 ? coverage.pct : null,
      coverageHave: coverage.have,
      coverageTotal: coverage.total,
    };
  } catch {
    return null;
  }
}

function MoveList({
  label,
  rows,
  month,
  tone,
}: {
  label: string;
  rows: ChaseRow[];
  month: string;
  tone: "gain" | "loss";
}) {
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-faint">{label}</div>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.stock_id} className="flex items-baseline justify-between gap-3 text-sm">
            <Link className="min-w-0 truncate hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
              {r.display_name}
            </Link>
            <span className={`shrink-0 tabular-nums ${tone === "gain" ? "text-gain" : "text-loss"}`}>
              {formatCompactShares(r.net_qty_delta)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Desk({
  letter,
  title,
  children,
}: {
  letter: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface text-sm font-medium text-foreground">
          {letter}
        </span>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-faint">{title}</div>
      </div>
      <p className="text-sm leading-6 text-muted">{children}</p>
    </div>
  );
}

export default async function LandingPage() {
  const preview = await loadPreview();

  return (
    <div className="space-y-12">
      <PrefetchHome
        month={preview?.month}
        seed={preview ? [...preview.inflows, ...preview.outflows] : undefined}
      />
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h1 className="min-w-0 flex-1 text-2xl font-medium tracking-tight text-pretty sm:text-3xl">
            What funds bought and sold — by share count.
          </h1>
          {preview?.month ? (
            <span
              className="w-fit shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted sm:mt-1.5"
              title={
                preview.coverageHave != null && preview.coverageTotal != null
                  ? `${preview.coverageHave} of ${preview.coverageTotal} AMCs in this book`
                  : undefined
              }
            >
              {formatMonthShort(preview.month)}
              {preview.coveragePct != null && preview.coveragePct < 100
                ? ` · ${preview.coveragePct}% AMCs`
                : ""}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Shares are not portfolio weight. Thinkbrew tracks actual share adds and cuts.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <AddsCutsLink className="rounded-md bg-foreground px-3.5 py-1.5 text-sm text-background">
            See adds & cuts
          </AddsCutsLink>
          <Link
            href="/screener"
            className="rounded-md border border-border bg-transparent px-3.5 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Screen funds
          </Link>
        </div>
      </section>

      <section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Desk letter="C" title="Chase">
            <AddsCutsLink className="text-foreground underline">Adds & cuts</AddsCutsLink> — what
            active-equity funds added or sold last month, by share count.
          </Desk>
          <Desk letter="S" title="Screen">
            <Link className="text-foreground underline" href="/screener">
              Screener
            </Link>{" "}
            and{" "}
            <Link className="text-foreground underline" href="/compare">
              Compare
            </Link>{" "}
            Direct Growth schemes by class, Sharpe, TER, and CAGR.
          </Desk>
          <Desk letter="W" title="Who owns">
            Spot crowded names — how many funds own a stock, and how that shifted.{" "}
            <Link className="text-foreground underline" href="/sectors">
              Sectors
            </Link>
            .
          </Desk>
          <Desk letter="B" title="My book">
            <Link className="text-foreground underline" href="/watchlist">
              Watchlist
            </Link>{" "}
            in this browser.{" "}
            <Link className="text-foreground underline" href="/portfolio">
              Portfolio
            </Link>{" "}
            soon.
          </Desk>
        </div>
      </section>

      {preview ? (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-medium">This month&apos;s biggest moves</h2>
            <AddsCutsLink className="text-sm text-muted underline hover:text-foreground">
              See all adds and cuts
            </AddsCutsLink>
          </div>
          <p className="mt-1 text-sm text-muted">Holdings as of {formatMonthLabel(preview.month)}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MoveList label="Biggest inflows" rows={preview.inflows} month={preview.month} tone="gain" />
            <MoveList label="Biggest outflows" rows={preview.outflows} month={preview.month} tone="loss" />
          </div>
        </section>
      ) : null}
    </div>
  );
}

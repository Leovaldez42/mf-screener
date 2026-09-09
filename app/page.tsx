import type { Metadata } from "next";
import Link from "next/link";
import { PrefetchHome } from "@/components/prefetch-home";
import { getChaseRows, resolveHoldingsMonth } from "@/lib/cached-holdings";
import { formatMonthLabel, formatNumber, sectorLabel } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabase";
import type { ChaseRow } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "MF Chase",
  description:
    "See what Indian active-equity mutual funds bought and sold last month. Adds and cuts, fund screener, and compare. Not investment advice.",
};

type Preview = {
  month: string;
  inflows: ChaseRow[];
  outflows: ChaseRow[];
};

async function loadPreview(): Promise<Preview | null> {
  if (!supabaseConfigured()) return null;
  try {
    const month = await resolveHoldingsMonth(null);
    if (!month) return null;
    const rows = await getChaseRows(month);
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
    return { month, inflows, outflows };
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
    <div className="rounded border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-[0.12em] text-faint">{label}</div>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.stock_id}>
            <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
              {r.display_name}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className={tone === "gain" ? "text-gain" : "text-loss"}>
                {tone === "gain" ? "+" : ""}
                {formatNumber(r.net_value_delta_cr, 1)} ₹ cr
              </span>
              <span className="text-muted">
                {sectorLabel(r.sector)} · {r.fund_count} funds
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function LandingPage() {
  const preview = await loadPreview();

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <PrefetchHome month={preview?.month} />
      <section>
        <h1 className="text-2xl font-medium tracking-tight">
          See what Indian active-equity funds bought and sold last month.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          This is a research tool, not a broker. It shows stocks that funds bought more of or sold,
          counted in <strong className="font-medium text-foreground">shares</strong> — a price bounce
          with no extra buying does not show up as a buy.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/adds-cuts"
            className="rounded border border-foreground bg-foreground px-3 py-1.5 text-sm text-background"
          >
            See adds & cuts
          </Link>
          <Link
            href="/screener"
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Screen funds
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium">What to do with this</h2>
        <p className="mt-1 text-sm text-muted">Three jobs. Pick one and click through.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">Follow the money</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Open{" "}
              <Link className="text-foreground underline" href="/adds-cuts">
                Adds & cuts
              </Link>
              , sort by Net ₹ cr, then click a stock to see which funds added or cut.
            </p>
          </div>
          <div className="rounded border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">Compare schemes</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              <Link className="text-foreground underline" href="/screener">
                Screener
              </Link>{" "}
              filters Direct Growth active-equity by Sharpe, TER, PE, and CAGR vs category.{" "}
              <Link className="text-foreground underline" href="/compare">
                Compare
              </Link>{" "}
              up to six.
            </p>
          </div>
          <div className="rounded border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-faint">Keep a short list</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tap Watch on a stock. The{" "}
              <Link className="text-foreground underline" href="/watchlist">
                watchlist
              </Link>{" "}
              stays in this browser — no login.
            </p>
          </div>
        </div>
      </section>

      {preview ? (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-medium">This month&apos;s biggest moves</h2>
            <Link className="text-sm text-muted underline hover:text-foreground" href="/adds-cuts">
              See all adds and cuts
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">Holdings as of {formatMonthLabel(preview.month)}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MoveList label="Biggest inflows" rows={preview.inflows} month={preview.month} tone="gain" />
            <MoveList label="Biggest outflows" rows={preview.outflows} month={preview.month} tone="loss" />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-xl font-medium">How to read the numbers</h2>
        <ul className="mt-3 max-w-2xl space-y-3 text-sm leading-6 text-muted">
          <li>
            Books land about <strong className="font-medium text-foreground">ten working days</strong> after
            month-end. Until then the table shows the last complete book.
          </li>
          <li>
            <strong className="font-medium text-foreground">Quantity, not weight.</strong> A stock can rise
            in weight because the price moved even if funds did not buy more shares.
          </li>
          <li>
            <strong className="font-medium text-foreground">Crowding</strong> — many funds in the same name —
            is a reason to inspect, not a buy or sell order.{" "}
            <Link className="text-foreground underline" href="/sectors">
              Sectors
            </Link>{" "}
            rolls the same diffs up by industry.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          This is not investment advice, and it is not affiliated with AMFI or any AMC.{" "}
          <Link className="text-foreground underline" href="/about">
            About the data
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

import Link from "next/link";
import { HomeSearchBox } from "@/components/command-search";
import { SectorPill } from "@/components/sector-pill";
import { formatMonthEnd, formatMonthLabel, formatNumber } from "@/lib/format";
import type { MonthlyReport, ReportSectorRow, ReportStockRow } from "@/lib/monthly-report";
import { formatCoverage } from "@/lib/report-copy";
import type { SearchSuggestion } from "@/lib/search";
import { formatSignedCr } from "@/lib/share-text";

function rupeeCr(n: number) {
  return `₹${formatNumber(Math.round(Math.abs(n)), 0)} cr`;
}

function MiniBar({ value, max, tone }: { value: number; max: number; tone: "gain" | "loss" }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-raised">
        <div className={`h-1.5 rounded-full ${tone === "gain" ? "bg-gain" : "bg-loss"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-24 shrink-0 text-right text-sm tabular-nums ${tone === "gain" ? "text-gain" : "text-loss"}`}>
        {formatSignedCr(value, 2).replace(" ₹ cr", "")}
      </span>
    </div>
  );
}

function HeadlineCard({
  kicker,
  name,
  sector,
  sectorFallback,
  value,
  detail,
  href,
}: {
  kicker: string;
  name: string;
  sector?: string | null;
  sectorFallback?: string;
  value: number;
  detail: string;
  href: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">{kicker}</div>
        {sector || sectorFallback ? <SectorPill sector={sector || sectorFallback || ""} /> : null}
      </div>
      <div className="mt-3 text-sm font-medium">{name}</div>
      <div className={`mt-1 text-2xl font-medium ${value >= 0 ? "text-gain" : "text-loss"}`}>
        {value > 0 ? "▲ " : value < 0 ? "▼ " : ""}
        {value > 0 ? "+" : value < 0 ? "−" : ""}₹{formatNumber(Math.abs(value), 0)} cr
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
      <Link href={href} className="mt-auto border-t border-border pt-3 text-sm text-accent hover:underline">
        See in report →
      </Link>
    </div>
  );
}

function sectorLead(report: MonthlyReport): { row: ReportSectorRow; other: ReportSectorRow | null } | null {
  const g = report.sectorRotation.gained[0];
  const l = report.sectorRotation.lost[0];
  if (!g && !l) return null;
  if (g && l) {
    const row = Math.abs(g.net_value_delta_cr) >= Math.abs(l.net_value_delta_cr) ? g : l;
    return { row, other: row === g ? l : g };
  }
  return { row: (g || l)!, other: null };
}

export function HomeLanding({
  report,
  suggestions,
}: {
  report: MonthlyReport;
  suggestions: SearchSuggestion[];
}) {
  const month = report.month;
  const label = formatMonthLabel(month);
  const s = report.summary;
  const net = s.totalNetEquityBuyingCr;
  const put = net >= 0;
  const buy = report.topNetBuys[0];
  const sell = report.topNetSells[0];
  const sector = sectorLead(report);
  const reportHref = `/reports/${month}`;
  const buys = report.topNetBuys.slice(0, 3);
  const sells = report.topNetSells.slice(0, 3);
  const buyMax = Math.max(1, ...buys.map((r) => Math.abs(r.net_value_delta_cr)));
  const sellMax = Math.max(1, ...sells.map((r) => Math.abs(r.net_value_delta_cr)));
  const fresh = report.freshEntries.slice(0, 4);
  const asOf = formatMonthEnd(month);

  return (
    <div className="space-y-10 pb-4">
      <section className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Monthly holdings report · {label}
        </div>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-medium tracking-tight text-pretty sm:text-4xl">
          {label}: funds {put ? "put" : "took"}{" "}
          <span className={put ? "text-gain" : "text-loss"}>{rupeeCr(net)}</span>{" "}
          {put ? "into equities" : "out of equities"}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted">
          Net equity buying across <span className="text-foreground">{formatNumber(s.fundsCovered, 0)}</span> funds
          from{" "}
          <span className="text-foreground">
            {formatNumber(s.fundHousesCovered, 0)} of {formatNumber(s.fundHousesTotal, 0)}
          </span>{" "}
          fund houses
          {asOf ? ` · Data as of ${asOf} portfolio disclosures` : ""}
        </p>
        <div className="mt-6">
          <HomeSearchBox suggestions={suggestions} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {buy ? (
          <HeadlineCard
            kicker="Top buy"
            name={buy.display_name}
            sector={buy.sector}
            value={buy.net_value_delta_cr}
            detail={`${formatNumber(buy.funds_adding, 0)} funds adding · ${formatNumber(buy.funds_cutting, 0)} cutting`}
            href={`${reportHref}#money-went`}
          />
        ) : null}
        {sell ? (
          <HeadlineCard
            kicker="Top sell"
            name={sell.display_name}
            sector={sell.sector}
            value={sell.net_value_delta_cr}
            detail={`${formatNumber(sell.funds_cutting, 0)} funds cutting · ${formatNumber(sell.funds_adding, 0)} adding`}
            href={`${reportHref}#money-left`}
          />
        ) : null}
        {sector ? (
          <HeadlineCard
            kicker="Top sector move"
            name={sector.row.sector}
            sector={sector.row.sector}
            value={sector.row.net_value_delta_cr}
            detail={
              sector.other
                ? sector.row.net_value_delta_cr >= 0
                  ? `Largest inflow · ${sector.other.sector} led outflows`
                  : `Largest outflow · ${sector.other.sector} led inflows`
                : sector.row.net_value_delta_cr >= 0
                  ? "Largest inflow"
                  : "Largest outflow"
            }
            href={`${reportHref}#sectors`}
          />
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card md:grid md:grid-cols-2">
        <div className="flex flex-col p-5 sm:p-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">This month&apos;s report</div>
          <h2 className="mt-2 text-xl font-medium sm:text-2xl">What fund managers bought in {label}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Top buys and sells, sector rotation, conviction bets and brand-new names — where India&apos;s equity funds
            moved money last month.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-faint">Funds covered</div>
              <div className="mt-1 font-medium tabular-nums">{formatNumber(s.fundsCovered, 0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-faint">Fund houses</div>
              <div className="mt-1 font-medium tabular-nums">{formatCoverage(s).replace(/ \(.+\)$/, "")}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-faint">Net equity buying</div>
              <div className={`mt-1 font-medium tabular-nums ${net >= 0 ? "text-gain" : "text-loss"}`}>
                {net >= 0 ? "+" : "−"}
                {rupeeCr(net)}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={reportHref}
              className="inline-flex rounded-md bg-accent px-3.5 py-2 text-sm text-accent-fg"
            >
              Read the report →
            </Link>
            <Link href="/adds-cuts" className="text-sm text-accent hover:underline">
              Browse adds & cuts
            </Link>
          </div>
        </div>
        <div className="space-y-5 border-t border-border bg-raised/40 p-5 sm:p-6 md:border-t-0 md:border-l">
          {buys.length ? (
            <div>
              <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-faint">
                <span>Top buys</span>
                <span>Net ₹ cr</span>
              </div>
              <ul className="space-y-2.5">
                {buys.map((r) => (
                  <li key={r.stock_id} className="grid grid-cols-[minmax(0,1fr)_11rem] items-center gap-3 text-sm">
                    <Link className="min-w-0 truncate hover:text-accent" href={`/stocks/${r.stock_id}?month=${month}`}>
                      {r.display_name}
                    </Link>
                    <MiniBar value={r.net_value_delta_cr} max={buyMax} tone="gain" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {sells.length ? (
            <div>
              <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-faint">
                <span>Top sells</span>
                <span>Net ₹ cr</span>
              </div>
              <ul className="space-y-2.5">
                {sells.map((r) => (
                  <li key={r.stock_id} className="grid grid-cols-[minmax(0,1fr)_11rem] items-center gap-3 text-sm">
                    <Link className="min-w-0 truncate hover:text-accent" href={`/stocks/${r.stock_id}?month=${month}`}>
                      {r.display_name}
                    </Link>
                    <MiniBar value={r.net_value_delta_cr} max={sellMax} tone="loss" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {fresh.length ? (
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">New names this month</h2>
              <p className="mt-1 text-sm text-muted">
                Stocks that entered fund portfolios for the first time in {formatMonthLabel(month).split(" ")[0]}
              </p>
            </div>
            <Link href={`${reportHref}#new-names`} className="shrink-0 text-sm text-accent hover:underline">
              See all →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {fresh.map((r: ReportStockRow) => (
              <Link
                key={r.stock_id}
                href={`/stocks/${r.stock_id}?month=${month}`}
                className="rounded-xl border border-border bg-card p-4 hover:border-faint"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-gain-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gain">
                    New
                  </span>
                  <SectorPill sector={r.sector} />
                </div>
                <div className="mt-3 text-sm font-medium">{r.display_name}</div>
                <div className="mt-3 flex items-baseline justify-between gap-2 text-xs text-muted">
                  <span>{formatNumber(r.funds_adding, 0)} funds</span>
                  <span className="text-gain">{formatSignedCr(r.net_value_delta_cr, 1)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-base font-medium">Tools</h2>
        <p className="mt-1 text-sm text-muted">Go deeper on any fund</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ToolTile
            href="/funds?tab=overlap"
            title="Check fund overlap"
            blurb="See how much two funds really share"
            icon="overlap"
          />
          <ToolTile href="/funds" title="Screen funds" blurb="Filter by category, house and returns" icon="screen" />
          <ToolTile
            href="/funds?tab=compare"
            title="Compare funds"
            blurb="Put up to four funds side by side"
            icon="compare"
          />
        </div>
      </section>
    </div>
  );
}

function ToolTile({
  href,
  title,
  blurb,
  icon,
}: {
  href: string;
  title: string;
  blurb: string;
  icon: "overlap" | "screen" | "compare";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-faint"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-raised text-accent" aria-hidden>
        {icon === "overlap" ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="6" cy="8" r="3.2" />
            <circle cx="10" cy="8" r="3.2" />
          </svg>
        ) : icon === "screen" ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 4.5h10M3 8h7M3 11.5h4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2.5" y="3.5" width="4" height="9" rx="0.8" />
            <rect x="9.5" y="3.5" width="4" height="9" rx="0.8" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{blurb}</span>
      </span>
      <span className="text-faint" aria-hidden>
        →
      </span>
    </Link>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SectionShare } from "@/components/section-share";
import { DataAsOfNote, Delta, UnavailableMonthNote } from "@/components/ui";
import { getMonthlyReport } from "@/lib/cached-report";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { shortenFundName } from "@/lib/fund-name";
import { listCompleteMonths } from "@/lib/holdings-month";
import {
  amcSentence,
  convictionSentence,
  formatCoverage,
  freshEntrySentence,
  fullExitSentence,
  mostBoughtSentence,
  mostSoldSentence,
  reportMetaDescription,
  sectorSentence,
  topNetBuySentence,
  topNetSellSentence,
} from "@/lib/report-copy";
import type { MonthlyReport, ReportAmcBet, ReportSectorRow, ReportStockRow } from "@/lib/monthly-report";
import { formatSignedCr } from "@/lib/share-text";
import { isYearMonth, siteUrl } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 300;

type Props = { params: Promise<{ month: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month: raw } = await params;
  const fallback = { title: "Report not found" };
  if (!isYearMonth(raw) || !supabaseConfigured()) return fallback;
  const complete = await listCompleteMonths();
  if (!complete.includes(raw)) return fallback;
  const report = await getMonthlyReport(raw);
  const label = formatMonthLabel(raw);
  const title = { absolute: `What mutual fund managers bought in ${label} · Thinkbrew` };
  const description = reportMetaDescription(report);
  const url = siteUrl(`/reports/${raw}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: title.absolute,
      description,
      siteName: "Thinkbrew",
    },
    twitter: {
      card: "summary_large_image",
      title: title.absolute,
      description,
    },
  };
}

function stockHref(id: string, month: string) {
  return `/stocks/${id}?month=${month}`;
}

function FundLinks({ row, month }: { row: ReportStockRow; month: string }) {
  if (!row.examples.length) return null;
  return (
    <span className="text-xs text-muted">
      {row.examples.map((ex, i) => (
        <span key={ex.family_id}>
          {i > 0 ? ", " : ""}
          <Link className="underline hover:text-foreground" href={`/funds/${ex.family_id}?month=${month}`}>
            {shortenFundName(ex.family_name, 28)}
          </Link>
        </span>
      ))}
    </span>
  );
}

function StockTable({
  rows,
  month,
  fundsLabel,
}: {
  rows: ReportStockRow[];
  month: string;
  fundsLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-lg text-left text-sm">
        <thead className="border-b border-border bg-surface text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Stock</th>
            <th className="px-3 py-2 font-medium">{fundsLabel}</th>
            <th className="px-3 py-2 font-medium">Net ₹ cr</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Sector</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Funds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stock_id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <Link className="font-medium underline-offset-2 hover:underline" href={stockHref(r.stock_id, month)}>
                  {r.display_name}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{formatNumber(r.funds, 0)}</td>
              <td className="px-3 py-2 tabular-nums">
                <Delta value={r.net_value_delta_cr} />
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <Link className="text-muted hover:text-foreground" href={`/sectors?month=${month}`}>
                  {r.sector}
                </Link>
              </td>
              <td className="hidden px-3 py-2 md:table-cell">
                <FundLinks row={r} month={month} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectorTable({ rows, month, tone }: { rows: ReportSectorRow[]; month: string; tone: "gain" | "loss" }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">{tone === "gain" ? "Inflow" : "Outflow"}</th>
            <th className="px-3 py-2 font-medium">Net ₹ cr</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sector} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <Link className="underline-offset-2 hover:underline" href={`/sectors?month=${month}`}>
                  {r.sector}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">
                <Delta value={r.net_value_delta_cr} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AmcTable({ rows, month }: { rows: ReportAmcBet[]; month: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-xl text-left text-sm">
        <thead className="border-b border-border bg-surface text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Fund house</th>
            <th className="px-3 py-2 font-medium">Biggest buy</th>
            <th className="px-3 py-2 font-medium">Biggest sell</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.amc_slug} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium">{r.amc_name}</td>
              <td className="px-3 py-2">
                {r.buy ? (
                  <>
                    <Link className="underline-offset-2 hover:underline" href={stockHref(r.buy.stock_id, month)}>
                      {r.buy.display_name}
                    </Link>
                    <span className="ml-2 tabular-nums text-gain">{formatSignedCr(r.buy.net_value_delta_cr, 0)}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                {r.sell ? (
                  <>
                    <Link className="underline-offset-2 hover:underline" href={stockHref(r.sell.stock_id, month)}>
                      {r.sell.display_name}
                    </Link>
                    <span className="ml-2 tabular-nums text-loss">{formatSignedCr(r.sell.net_value_delta_cr, 0)}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBlock({
  id,
  title,
  sentence,
  shareUrl,
  shareText,
  children,
}: {
  id: string;
  title: string;
  sentence: string;
  shareUrl: string;
  shareText: string;
  children: ReactNode;
}) {
  if (!sentence) return null;
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        <SectionShare title={title} text={shareText} url={shareUrl} />
      </div>
      <p className="text-sm text-muted">{sentence}</p>
      {children}
    </section>
  );
}

function TopThree({
  label,
  rows,
  month,
  tone,
}: {
  label: string;
  rows: ReportStockRow[];
  month: string;
  tone: "gain" | "loss";
}) {
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-faint">{label}</div>
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 3).map((r) => (
          <li key={r.stock_id} className="flex items-baseline justify-between gap-3 text-sm">
            <Link className="min-w-0 truncate hover:underline" href={stockHref(r.stock_id, month)}>
              {r.display_name}
            </Link>
            <span className={`shrink-0 tabular-nums ${tone === "gain" ? "text-gain" : "text-loss"}`}>
              {r.funds} funds
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ReportMonthPage({ params }: Props) {
  const { month: raw } = await params;
  if (!isYearMonth(raw) || !supabaseConfigured()) notFound();
  const complete = await listCompleteMonths();
  if (!complete.includes(raw)) notFound();
  const report: MonthlyReport = await getMonthlyReport(raw);
  const month = report.month;
  const label = formatMonthLabel(month);
  const pageUrl = siteUrl(`/reports/${month}`);
  const s = report.summary;

  function share(section: string, sentence: string) {
    return {
      shareUrl: `${pageUrl}#${section}`,
      shareText: `${sentence} ${label} · Thinkbrew`.trim(),
    };
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-faint">
          <Link href="/reports" className="hover:text-foreground">
            Reports
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-medium sm:text-2xl">What fund managers bought in {label}</h1>
        <div className="mt-2 space-y-1">
          <UnavailableMonthNote requested={raw} showing={month} />
          <DataAsOfNote />
        </div>
        <details className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted">How we calculate this</summary>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Month-end holdings disclosures for active-equity funds. We count share-quantity adds and cuts,
            not portfolio weight. Cash, TREPS, ETFs, fund units and derivatives are dropped. Funds with no
            prior-month book (a first disclosure) are excluded from month-on-month counts so the whole book
            is not treated as &quot;bought.&quot; {s.excludedNoPriorMonth} fund
            {s.excludedNoPriorMonth === 1 ? " was" : "s were"} excluded this month.
          </p>
        </details>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-[0.12em] text-faint">Funds covered</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatNumber(s.fundsCovered, 0)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-[0.12em] text-faint">Fund houses</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatCoverage(s)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-[0.12em] text-faint">Net equity buying</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">
            <Delta value={s.totalNetEquityBuyingCr} />
            <span className="ml-1 text-sm font-normal text-muted">₹ cr</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TopThree label="Most bought" rows={report.mostBought} month={month} tone="gain" />
        <TopThree label="Most sold" rows={report.mostSold} month={month} tone="loss" />
      </div>

      <SectionBlock
        id="mostBought"
        title="Most bought"
        sentence={mostBoughtSentence(report.mostBought)}
        {...share("mostBought", mostBoughtSentence(report.mostBought))}
      >
        <StockTable rows={report.mostBought} month={month} fundsLabel="Funds adding" />
      </SectionBlock>

      <SectionBlock
        id="mostSold"
        title="Most sold"
        sentence={mostSoldSentence(report.mostSold)}
        {...share("mostSold", mostSoldSentence(report.mostSold))}
      >
        <StockTable rows={report.mostSold} month={month} fundsLabel="Funds cutting" />
      </SectionBlock>

      <SectionBlock
        id="topNetBuys"
        title="Largest net buys"
        sentence={topNetBuySentence(report.topNetBuys)}
        {...share("topNetBuys", topNetBuySentence(report.topNetBuys))}
      >
        <StockTable rows={report.topNetBuys} month={month} fundsLabel="Funds adding" />
      </SectionBlock>

      <SectionBlock
        id="topNetSells"
        title="Largest net sells"
        sentence={topNetSellSentence(report.topNetSells)}
        {...share("topNetSells", topNetSellSentence(report.topNetSells))}
      >
        <StockTable rows={report.topNetSells} month={month} fundsLabel="Funds cutting" />
      </SectionBlock>

      <SectionBlock
        id="conviction"
        title="Conviction buys"
        sentence={convictionSentence(report.convictionBuys)}
        {...share("conviction", convictionSentence(report.convictionBuys))}
      >
        <StockTable rows={report.convictionBuys} month={month} fundsLabel="Funds adding" />
        {report.convictionOmitted > 0 ? (
          <p className="text-sm text-muted">{report.convictionOmitted} more</p>
        ) : null}
      </SectionBlock>

      <SectionBlock
        id="freshEntries"
        title="Fresh entries"
        sentence={freshEntrySentence(report.freshEntries)}
        {...share("freshEntries", freshEntrySentence(report.freshEntries))}
      >
        <StockTable rows={report.freshEntries} month={month} fundsLabel="Funds adding" />
      </SectionBlock>

      <SectionBlock
        id="fullExits"
        title="Full exits"
        sentence={fullExitSentence(report.fullExits)}
        {...share("fullExits", fullExitSentence(report.fullExits))}
      >
        <StockTable rows={report.fullExits} month={month} fundsLabel="Funds exiting" />
      </SectionBlock>

      <SectionBlock
        id="sectors"
        title="Sector rotation"
        sentence={sectorSentence(report)}
        {...share("sectors", sectorSentence(report))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SectorTable rows={report.sectorRotation.gained} month={month} tone="gain" />
          <SectorTable rows={report.sectorRotation.lost} month={month} tone="loss" />
        </div>
      </SectionBlock>

      <SectionBlock
        id="amcBigBets"
        title="House-level bets"
        sentence={amcSentence(report)}
        {...share("amcBigBets", amcSentence(report))}
      >
        <AmcTable rows={report.amcBigBets} month={month} />
      </SectionBlock>
    </div>
  );
}

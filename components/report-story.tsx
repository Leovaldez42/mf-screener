"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { SectorPill } from "@/components/sector-pill";
import { ShareBar } from "@/components/share-bar";
import { DataAsOfNote, Delta, UnavailableMonthNote } from "@/components/ui";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import type { MonthlyReport, ReportAmcBet, ReportSectorRow, ReportStockRow } from "@/lib/monthly-report";
import {
  formatCoverage,
  freshEntrySentence,
  fullExitSentence,
  mostBoughtSentence,
  mostSoldSentence,
  sectorSentence,
  topNetBuySentence,
  topNetSellSentence,
  amcSentence,
} from "@/lib/report-copy";
import { sectorFill } from "@/lib/sector-color";
import { formatSignedCr } from "@/lib/share-text";

function stockHref(id: string, month: string) {
  return `/stocks/${id}?month=${month}`;
}

function CopyAnchor({ id }: { id: string }) {
  const [ok, setOk] = useState(false);
  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setOk(true);
      window.setTimeout(() => setOk(false), 1200);
    } catch {
      setOk(false);
    }
  }
  return (
    <button
      type="button"
      className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-raised hover:text-accent"
      aria-label="Copy section link"
      title={ok ? "Copied" : "Copy link"}
      onClick={(e) => void copy(e)}
    >
      {ok ? (
        <span className="text-[10px] text-accent">✓</span>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path
            d="M6.5 9.5a3 3 0 0 0 4.24 0l1.76-1.76a3 3 0 0 0-4.24-4.24L7.5 4.25"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M9.5 6.5a3 3 0 0 0-4.24 0L3.5 8.26a3 3 0 0 0 4.24 4.24L8.5 11.75"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

function SectionHead({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 flex items-center text-lg font-medium">
      {title}
      <CopyAnchor id={id} />
    </h2>
  );
}

function Tabs({
  value,
  onChange,
}: {
  value: "cr" | "funds";
  onChange: (v: "cr" | "funds") => void;
}) {
  const tab = (id: "cr" | "funds", label: string) => (
    <button
      type="button"
      className={`border-b-2 px-3 py-1 text-sm ${
        value === id ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
      }`}
      onClick={() => onChange(id)}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1 border-b border-border" role="tablist">
      {tab("cr", "By ₹")}
      {tab("funds", "By number of funds")}
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "conviction" | "fresh" }) {
  const cls =
    tone === "conviction"
      ? "bg-gain-muted text-gain"
      : "bg-raised text-accent";
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>{children}</span>;
}

function FundExpand({ row, month }: { row: ReportStockRow; month: string }) {
  const adding = row.adding?.length ? row.adding : [];
  const cutting = row.cutting?.length ? row.cutting : [];
  return (
    <div className="grid gap-3 pt-1 text-sm sm:grid-cols-2">
      <div>
        <div className="text-xs uppercase tracking-[0.12em] text-faint">Adding ({adding.length})</div>
        {adding.length ? (
          <ul className="mt-1 space-y-0.5">
            {adding.map((f) => (
              <li key={f.family_id}>
                <Link className="text-accent hover:underline" href={`/funds/${f.family_id}?month=${month}`}>
                  {f.family_name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">None</p>
        )}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.12em] text-faint">Cutting ({cutting.length})</div>
        {cutting.length ? (
          <ul className="mt-1 space-y-0.5">
            {cutting.map((f) => (
              <li key={f.family_id}>
                <Link className="text-accent hover:underline" href={`/funds/${f.family_id}?month=${month}`}>
                  {f.family_name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">None</p>
        )}
      </div>
    </div>
  );
}

function MoneyTable({
  rows,
  month,
}: {
  rows: ReportStockRow[];
  month: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-raised text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Net ₹ cr</th>
              <th className="px-3 py-2 font-medium">Funds adding / cutting</th>
              <th className="px-3 py-2 font-medium">Sector</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expanded = open === r.stock_id;
              return (
                <tr
                  key={r.stock_id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-raised/60"
                  onClick={() => setOpen(expanded ? null : r.stock_id)}
                >
                  <td className="px-3 py-2" colSpan={expanded ? 4 : undefined}>
                    {expanded ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="font-medium hover:text-accent hover:underline"
                            href={stockHref(r.stock_id, month)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.display_name}
                          </Link>
                          {r.is_conviction ? <Pill tone="conviction">Conviction</Pill> : null}
                          {r.is_fresh ? <Pill tone="fresh">IPO / new</Pill> : null}
                        </div>
                        <FundExpand row={r} month={month} />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="font-medium hover:text-accent hover:underline"
                          href={stockHref(r.stock_id, month)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.display_name}
                        </Link>
                        {r.is_conviction ? <Pill tone="conviction">Conviction</Pill> : null}
                        {r.is_fresh ? <Pill tone="fresh">IPO / new</Pill> : null}
                      </div>
                    )}
                  </td>
                  {expanded ? null : (
                    <>
                      <td className="px-3 py-2 tabular-nums">
                        <Delta value={r.net_value_delta_cr} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted">
                        {formatNumber(r.funds_adding, 0)} / {formatNumber(r.funds_cutting, 0)}
                      </td>
                      <td className="px-3 py-2">
                        <SectorPill sector={r.sector} />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => {
          const expanded = open === r.stock_id;
          return (
            <li key={r.stock_id} className="rounded-lg border border-border bg-card p-3">
              <button type="button" className="w-full text-left" onClick={() => setOpen(expanded ? null : r.stock_id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      className="font-medium hover:text-accent hover:underline"
                      href={stockHref(r.stock_id, month)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.display_name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.is_conviction ? <Pill tone="conviction">Conviction</Pill> : null}
                      {r.is_fresh ? <Pill tone="fresh">IPO / new</Pill> : null}
                      <SectorPill sector={r.sector} />
                    </div>
                  </div>
                  <Delta value={r.net_value_delta_cr} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Funds adding / cutting {formatNumber(r.funds_adding, 0)} / {formatNumber(r.funds_cutting, 0)}
                </p>
              </button>
              {expanded ? (
                <div className="mt-3 border-t border-border pt-3">
                  <FundExpand row={r} month={month} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SectorBars({ gained, lost }: { gained: ReportSectorRow[]; lost: ReportSectorRow[] }) {
  const rows = useMemo(() => {
    const inRows = [...gained].sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr);
    const outRows = [...lost].sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr);
    return [...inRows, ...outRows];
  }, [gained, lost]);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net_value_delta_cr)));
  if (!rows.length) return null;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = (Math.abs(r.net_value_delta_cr) / max) * 50;
        const buy = r.net_value_delta_cr >= 0;
        return (
          <li
            key={r.sector}
            className="grid grid-cols-[12.5rem_minmax(0,1fr)_7.25rem] items-start gap-x-3 gap-y-1 text-sm sm:grid-cols-[16rem_minmax(0,1fr)_8rem] sm:items-center"
          >
            <span className="flex items-start gap-1.5 text-muted">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: sectorFill(r.sector) }}
                aria-hidden
              />
              <span className="leading-snug">{r.sector}</span>
            </span>
            <div className="relative h-2 overflow-hidden rounded-full bg-raised">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
              {buy ? (
                <div className="absolute top-0 left-1/2 h-2 rounded-r-full bg-gain" style={{ width: `${pct}%` }} />
              ) : (
                <div className="absolute top-0 right-1/2 h-2 rounded-l-full bg-loss" style={{ width: `${pct}%` }} />
              )}
            </div>
            <span className="text-right">
              <Delta value={r.net_value_delta_cr} className="justify-end" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function HouseCard({ row, month }: { row: ReportAmcBet; month: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-sm font-medium">{row.amc_name}</div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-faint">Buy</span>
          {row.buy ? (
            <span className="min-w-0 truncate text-right">
              <Link className="hover:text-accent hover:underline" href={stockHref(row.buy.stock_id, month)}>
                {row.buy.display_name}
              </Link>{" "}
              <Delta value={row.buy.net_value_delta_cr} />
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-faint">Sell</span>
          {row.sell ? (
            <span className="min-w-0 truncate text-right">
              <Link className="hover:text-accent hover:underline" href={stockHref(row.sell.stock_id, month)}>
                {row.sell.display_name}
              </Link>{" "}
              <Delta value={row.sell.net_value_delta_cr} />
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReportStory({
  report,
  requested,
  pageUrl,
  shareText,
}: {
  report: MonthlyReport;
  requested: string;
  pageUrl: string;
  shareText: string;
}) {
  const month = report.month;
  const label = formatMonthLabel(month);
  const s = report.summary;
  const [wentTab, setWentTab] = useState<"cr" | "funds">("cr");
  const [leftTab, setLeftTab] = useState<"cr" | "funds">("cr");
  const [allFresh, setAllFresh] = useState(false);
  const [allExits, setAllExits] = useState(false);
  const [allHouses, setAllHouses] = useState(false);

  const wentRows = wentTab === "cr" ? report.topNetBuys : report.moneyWentByFunds;
  const leftRows = leftTab === "cr" ? report.topNetSells : report.moneyLeftByFunds;
  const wentSentence = wentTab === "cr" ? topNetBuySentence(wentRows) : mostBoughtSentence(wentRows);
  const leftSentence = leftTab === "cr" ? topNetSellSentence(leftRows) : mostSoldSentence(leftRows);

  const freshShown = allFresh ? report.freshEntries : report.freshEntries.slice(0, 8);
  const exitsShown = allExits ? report.fullExits : report.fullExits.slice(0, 10);
  const housesShown = allHouses ? report.amcBigBets : report.amcBigBets.slice(0, 12);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-faint">
            <Link href="/reports" className="text-accent hover:underline">
              Reports
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-medium sm:text-2xl">What fund managers bought in {label}</h1>
          <div className="mt-2 space-y-1">
            <UnavailableMonthNote requested={requested} showing={month} />
            <DataAsOfNote />
          </div>
          <details className="mt-3 rounded-lg border border-border bg-raised px-3 py-2 text-sm">
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
        <ShareBar title={`What fund managers bought in ${label}`} text={shareText} url={pageUrl} />
      </div>

      <div>
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
        {s.excludedNoPriorMonth > 0 ? (
          <p className="mt-2 text-sm text-muted">
            Excludes {s.excludedNoPriorMonth} fund{s.excludedNoPriorMonth === 1 ? "" : "s"} with no prior month, so
            totals differ slightly from Adds & cuts.
          </p>
        ) : null}
      </div>

      {wentRows.length ? (
        <section className="space-y-3" aria-labelledby="money-went">
          <SectionHead id="money-went" title="Where the money went" />
          <Tabs value={wentTab} onChange={setWentTab} />
          {wentSentence ? <p className="text-sm text-muted">{wentSentence}</p> : null}
          <MoneyTable rows={wentRows} month={month} />
        </section>
      ) : null}

      {leftRows.length ? (
        <section className="space-y-3" aria-labelledby="money-left">
          <SectionHead id="money-left" title="Where the money left" />
          <Tabs value={leftTab} onChange={setLeftTab} />
          {leftSentence ? <p className="text-sm text-muted">{leftSentence}</p> : null}
          <MoneyTable rows={leftRows} month={month} />
        </section>
      ) : null}

      {report.freshEntries.length ? (
        <section className="space-y-3" aria-labelledby="new-names">
          <SectionHead id="new-names" title="New names" />
          <p className="text-sm text-muted">{freshEntrySentence(report.freshEntries)}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {freshShown.map((r) => (
              <Link
                key={r.stock_id}
                href={stockHref(r.stock_id, month)}
                className="rounded-lg border border-border bg-card p-3 hover:border-accent"
              >
                <div className="truncate text-sm font-medium">{r.display_name}</div>
                <p className="mt-1 text-xs text-muted">
                  {formatNumber(r.funds_adding, 0)} funds · {formatSignedCr(r.net_value_delta_cr, 1)}
                </p>
              </Link>
            ))}
          </div>
          {!allFresh && report.freshEntries.length > 8 ? (
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => setAllFresh(true)}>
              View all {report.freshEntries.length}
            </button>
          ) : null}
        </section>
      ) : null}

      {report.fullExits.length ? (
        <section className="space-y-3" aria-labelledby="full-exits">
          <SectionHead id="full-exits" title="Full exits" />
          <p className="text-sm text-muted">{fullExitSentence(report.fullExits)}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {exitsShown.map((r) => (
              <li key={r.stock_id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <Link className="min-w-0 truncate hover:text-accent hover:underline" href={stockHref(r.stock_id, month)}>
                  {r.display_name}
                </Link>
                <span className="shrink-0 text-right">
                  <span className="block tabular-nums">{formatNumber(r.funds, 0)} funds exited</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Net across all funds: {formatSignedCr(r.net_value_delta_cr, 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {!allExits && report.fullExits.length > 10 ? (
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => setAllExits(true)}>
              View all {report.fullExits.length}
            </button>
          ) : null}
        </section>
      ) : null}

      {report.sectorRotation.gained.length || report.sectorRotation.lost.length ? (
        <section className="space-y-3" aria-labelledby="sectors">
          <SectionHead id="sectors" title="Sector rotation" />
          <p className="text-sm text-muted">{sectorSentence(report)}</p>
          <SectorBars gained={report.sectorRotation.gained} lost={report.sectorRotation.lost} />
        </section>
      ) : null}

      {report.amcBigBets.length ? (
        <section className="space-y-3" aria-labelledby="fund-houses">
          <SectionHead id="fund-houses" title="Fund house bets" />
          <p className="text-sm text-muted">{amcSentence(report)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {housesShown.map((r) => (
              <HouseCard key={r.amc_slug} row={r} month={month} />
            ))}
          </div>
          {!allHouses && report.amcBigBets.length > 12 ? (
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => setAllHouses(true)}>
              View all fund houses
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

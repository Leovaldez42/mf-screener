import { formatMonthLabel, formatNumber } from "@/lib/format";
import { formatSignedCr } from "@/lib/share-text";
import type { MonthlyReport, ReportStockRow } from "@/lib/monthly-report";

function cr(n: number) {
  return formatSignedCr(n, n >= 100 || n <= -100 ? 0 : 1);
}

export function reportListHeadline(report: MonthlyReport): string {
  const names = report.mostBought.slice(0, 3).map((r) => r.display_name);
  if (names.length >= 3) return `Funds piled into ${names[0]}, ${names[1]} and ${names[2]}.`;
  if (names.length === 2) return `Funds piled into ${names[0]} and ${names[1]}.`;
  if (names.length === 1) return `Funds piled into ${names[0]}.`;
  if (report.summary.excludedNoPriorMonth && !report.mostBought.length) {
    return "Not enough comparable prior-month books for a month-on-month read.";
  }
  return `Active-equity books for ${formatMonthLabel(report.month)}.`;
}

export function mostBoughtSentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `${top.funds} more funds held ${top.display_name} this month, the most of any stock.`;
}

export function mostSoldSentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `${top.funds} funds cut or exited ${top.display_name}, the most of any stock.`;
}

export function topNetBuySentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `Funds put ${cr(top.net_value_delta_cr)} into ${top.display_name}, the largest net buy.`;
}

export function topNetSellSentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `Funds took ${cr(top.net_value_delta_cr)} out of ${top.display_name}, the largest net sell.`;
}

export function convictionSentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `${top.display_name} was added by ${top.funds} funds across ${top.fund_houses} houses.`;
}

export function freshEntrySentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `${top.display_name} was not in any active-equity book last month; ${top.funds} funds bought it.`;
}

export function fullExitSentence(rows: ReportStockRow[]): string {
  const top = rows[0];
  if (!top) return "";
  return `${top.funds} funds fully exited ${top.display_name}.`;
}

export function sectorSentence(report: MonthlyReport): string {
  const g = report.sectorRotation.gained[0];
  const l = report.sectorRotation.lost[0];
  if (g && l) {
    return `${g.sector} saw the largest net inflow (${cr(g.net_value_delta_cr)}); ${l.sector} the largest outflow (${cr(l.net_value_delta_cr)}).`;
  }
  if (g) return `${g.sector} saw the largest net inflow (${cr(g.net_value_delta_cr)}).`;
  if (l) return `${l.sector} saw the largest net outflow (${cr(l.net_value_delta_cr)}).`;
  return "";
}

export function amcSentence(report: MonthlyReport): string {
  const withBuy = report.amcBigBets.find((b) => b.buy);
  if (withBuy?.buy) {
    return `${withBuy.amc_name} made its biggest buy in ${withBuy.buy.display_name} (${cr(withBuy.buy.net_value_delta_cr)}).`;
  }
  const withSell = report.amcBigBets.find((b) => b.sell);
  if (withSell?.sell) {
    return `${withSell.amc_name} made its biggest sell in ${withSell.sell.display_name} (${cr(withSell.sell.net_value_delta_cr)}).`;
  }
  return "";
}

export function reportMetaDescription(report: MonthlyReport): string {
  const names = report.mostBought.slice(0, 3).map((r) => r.display_name);
  const month = formatMonthLabel(report.month);
  if (names.length) {
    return `What Indian active-equity funds bought in ${month}. Most added: ${names.join(", ")}. Not investment advice.`;
  }
  return `What Indian active-equity funds bought and sold in ${month}. Not investment advice.`;
}

export function formatCoverage(summary: MonthlyReport["summary"]): string {
  return `${formatNumber(summary.fundHousesCovered, 0)} of ${formatNumber(summary.fundHousesTotal, 0)} (${summary.fundHousesCoveragePct}%)`;
}

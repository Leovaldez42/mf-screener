import type { Metadata } from "next";
import { HomeLanding } from "@/components/home-landing";
import { getMonthlyReport } from "@/lib/cached-report";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { listCompleteMonths } from "@/lib/holdings-month";
import { pageMetadata } from "@/lib/page-meta";
import { searchCatalog } from "@/lib/search";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const fallback = pageMetadata({
    title: "Thinkbrew",
    description:
      "See what Indian active-equity mutual funds bought and sold last month. Adds and cuts, fund books, and reports. Not investment advice.",
    path: "/",
  });
  if (!supabaseConfigured()) return fallback;
  try {
    const months = await listCompleteMonths();
    const month = months[0];
    if (!month) return fallback;
    const report = await getMonthlyReport(month);
    const label = formatMonthLabel(month);
    const net = report.summary.totalNetEquityBuyingCr;
    const abs = `₹${formatNumber(Math.round(Math.abs(net)), 0)} cr`;
    const title =
      net >= 0
        ? `${label}: funds put ${abs} into equities · Thinkbrew`
        : `${label}: funds took ${abs} out of equities · Thinkbrew`;
    const description = `Net equity buying across ${formatNumber(report.summary.fundsCovered, 0)} active-equity funds. What Indian mutual funds bought and sold in ${label}. Not investment advice.`;
    return pageMetadata({ title, description, path: "/" });
  } catch {
    return fallback;
  }
}

export default async function LandingPage() {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const months = await listCompleteMonths();
  const month = months[0];
  if (!month) {
    return <p className="text-sm text-muted">No holdings months yet.</p>;
  }
  const [report, search] = await Promise.all([getMonthlyReport(month), searchCatalog("")]);
  return <HomeLanding report={report} suggestions={search.suggestions} />;
}

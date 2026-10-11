import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportStory } from "@/components/report-story";
import { getMonthlyReport } from "@/lib/cached-report";
import { formatMonthLabel } from "@/lib/format";
import { listCompleteMonths } from "@/lib/holdings-month";
import { reportMetaDescription } from "@/lib/report-copy";
import { isYearMonth, siteUrl } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
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

export default async function ReportMonthPage({ params }: Props) {
  const { month: raw } = await params;
  if (!isYearMonth(raw) || !supabaseConfigured()) notFound();
  const complete = await listCompleteMonths();
  if (!complete.includes(raw)) notFound();
  const report = await getMonthlyReport(raw);
  const label = formatMonthLabel(report.month);
  const pageUrl = siteUrl(`/reports/${report.month}`);
  const lead =
    report.topNetBuys[0]?.display_name || report.moneyWentByFunds[0]?.display_name || "active-equity books";
  const shareText = `What fund managers bought in ${label}: ${lead}. ${pageUrl}`;

  return <ReportStory report={report} requested={raw} pageUrl={pageUrl} shareText={shareText} />;
}

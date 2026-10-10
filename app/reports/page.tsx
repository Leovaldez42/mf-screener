import type { Metadata } from "next";
import Link from "next/link";
import { getMonthlyReport } from "@/lib/cached-report";
import { formatMonthLabel } from "@/lib/format";
import { listCompleteMonths } from "@/lib/holdings-month";
import { reportListHeadline } from "@/lib/report-copy";
import { pageMetadata } from "@/lib/page-meta";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "What fund managers bought · Thinkbrew",
  description:
    "Monthly reports of what Indian active-equity mutual funds bought and sold. Not investment advice.",
  path: "/reports",
});

export default async function ReportsIndexPage() {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const months = await listCompleteMonths();
  if (!months.length) {
    return <p className="text-sm text-muted">No holdings months yet.</p>;
  }

  const reports = await Promise.all(
    months.map(async (month) => {
      const report = await getMonthlyReport(month);
      return { month, headline: reportListHeadline(report) };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          What fund managers bought, from month-end active-equity disclosures. Newest first.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {reports.map((r) => (
          <li key={r.month}>
            <Link href={`/reports/${r.month}`} className="block px-4 py-3 hover:bg-surface">
              <div className="text-sm font-medium">{formatMonthLabel(r.month)}</div>
              <p className="mt-0.5 text-sm text-muted">{r.headline}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

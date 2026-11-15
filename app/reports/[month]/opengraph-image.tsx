import { getMonthlyReport } from "@/lib/cached-report";
import { requireHoldingsMonth } from "@/lib/cached-holdings";
import { reportHeroOgImage, reportOgFallback } from "@/lib/report-og";
import { OG_SIZE } from "@/lib/site";
import { isYearMonth } from "@/lib/site";
import { getSiteMeta } from "@/lib/snapshot-read";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 86400;
export const dynamicParams = true;
export const alt = "What fund managers bought";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  if (!supabaseConfigured()) return [];
  try {
    const meta = await getSiteMeta();
    return (meta?.months || []).map((month) => ({ month }));
  } catch {
    return [];
  }
}

export default async function Image({ params }: { params: Promise<{ month: string }> }) {
  if (!supabaseConfigured()) return reportOgFallback("Data source is not configured");
  const { month } = await params;
  if (!isYearMonth(month)) return reportOgFallback("Unknown month");
  try {
    const picked = await requireHoldingsMonth(month);
    if (!picked.ok) return reportOgFallback("Unknown month");
    const report = await getMonthlyReport(picked.month);
    return reportHeroOgImage(report);
  } catch (e) {
    return reportOgFallback(e instanceof Error ? e.message : "Could not build image");
  }
}

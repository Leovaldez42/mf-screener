import { getMonthlyReport } from "@/lib/cached-report";
import { requireHoldingsMonth } from "@/lib/cached-holdings";
import { reportOgFallback, reportSectionOgImage } from "@/lib/report-og";
import { isYearMonth } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 3600;

const SECTIONS = ["mostBought", "mostSold", "conviction", "sectors"] as const;
type Section = (typeof SECTIONS)[number];

function isSection(v: string | null): v is Section {
  return Boolean(v && (SECTIONS as readonly string[]).includes(v));
}

export async function GET(request: Request) {
  if (!supabaseConfigured()) {
    return reportOgFallback("Data source is not configured");
  }
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const section = url.searchParams.get("section");
  if (!month || !isYearMonth(month) || !isSection(section)) {
    return reportOgFallback("Unknown report card");
  }
  try {
    const picked = await requireHoldingsMonth(month);
    if (!picked.ok) return reportOgFallback("Unknown month");
    const report = await getMonthlyReport(picked.month);
    return reportSectionOgImage(report, section);
  } catch (e) {
    return reportOgFallback(e instanceof Error ? e.message : "Could not build image");
  }
}

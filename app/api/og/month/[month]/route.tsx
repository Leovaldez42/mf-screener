import { loadOgMonthCard } from "@/lib/og-data";
import { monthOgImage, ogFallback } from "@/lib/og-image";
import { isYearMonth } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ month: string }> }) {
  if (!supabaseConfigured()) {
    return ogFallback("Data source is not configured");
  }
  const { month } = await params;
  if (!isYearMonth(month)) {
    return ogFallback("Unknown month");
  }
  try {
    const card = await loadOgMonthCard(month);
    if (!card) return ogFallback("No holdings for this month");
    return monthOgImage(card);
  } catch (e) {
    return ogFallback(e instanceof Error ? e.message : "Could not build image");
  }
}

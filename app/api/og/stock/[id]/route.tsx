import { loadOgStockCard } from "@/lib/og-data";
import { ogFallback, stockOgImage } from "@/lib/og-image";
import { isYearMonth } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured()) {
    return ogFallback("Data source is not configured");
  }
  const { id } = await params;
  const month = new URL(req.url).searchParams.get("month") || "";
  if (month && !isYearMonth(month)) {
    return ogFallback("Unknown month");
  }
  try {
    const card = await loadOgStockCard(id, month);
    if (!card) return ogFallback("Stock not found");
    return stockOgImage(card);
  } catch (e) {
    return ogFallback(e instanceof Error ? e.message : "Could not build image");
  }
}

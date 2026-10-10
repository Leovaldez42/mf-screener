import { siteOgImage } from "@/lib/fund-og";
import { listCompleteMonths } from "@/lib/holdings-month";
import { reportOgFallback } from "@/lib/report-og";
import { OG_SIZE } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;
export const alt = "Thinkbrew";
export const size = OG_SIZE;
export const contentType = "image/png";

const TAGLINE = "See what Indian active-equity mutual funds bought and sold last month.";

export default async function Image() {
  if (!supabaseConfigured()) {
    return siteOgImage({ tagline: TAGLINE, month: null });
  }
  try {
    const months = await listCompleteMonths();
    return siteOgImage({ tagline: TAGLINE, month: months[0] ?? null });
  } catch (e) {
    return reportOgFallback(e instanceof Error ? e.message : "Thinkbrew");
  }
}

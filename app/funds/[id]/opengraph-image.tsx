import { getFundPayload } from "@/lib/cached-holdings";
import { fundOgImage } from "@/lib/fund-og";
import { reportOgFallback } from "@/lib/report-og";
import { OG_SIZE } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "Fund holdings";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured()) return reportOgFallback("Data source is not configured");
  const { id } = await params;
  const familyId = Number(id);
  if (!Number.isFinite(familyId)) return reportOgFallback("Fund not found");
  try {
    const payload = await getFundPayload(familyId, "");
    if ("error" in payload && (payload.error === "not_found" || payload.error === "unknown_month")) {
      return reportOgFallback("Fund not found");
    }
    if (!("family" in payload) || !payload.family) return reportOgFallback("Fund not found");
    return fundOgImage({
      name: String(payload.family.name),
      category: String(payload.family.sebi_category || "Active equity"),
      month: payload.month,
      holdings: (payload.holdings || []).map((h) => ({
        display_name: h.display_name,
        weight_pct: h.weight_pct,
      })),
    });
  } catch (e) {
    return reportOgFallback(e instanceof Error ? e.message : "Could not build image");
  }
}

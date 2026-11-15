import { NextRequest } from "next/server";
import { getMonthlyReport } from "@/lib/cached-report";
import { requireHoldingsMonth } from "@/lib/cached-holdings";
import { HOLDINGS_CACHE_CONTROL, SNAPSHOT_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 86400;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured" }, 503);
  }
  const month = req.nextUrl.searchParams.get("month");
  try {
    const picked = await requireHoldingsMonth(month);
    if (!picked.ok) {
      if (picked.unknown) {
        return jsonCached(
          { error: "unknown_month", availableMonths: picked.availableMonths },
          HOLDINGS_CACHE_CONTROL,
          404,
        );
      }
      return jsonCached({ month: null, error: "no_holdings" }, HOLDINGS_CACHE_CONTROL);
    }
    const report = await getMonthlyReport(picked.month, picked.availableMonths[0]);
    return jsonCached(report, SNAPSHOT_CACHE_CONTROL);
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "report_failed" }, 500);
  }
}

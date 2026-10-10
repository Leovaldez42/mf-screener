import { NextRequest } from "next/server";
import { getSectorRows, requireHoldingsMonth } from "@/lib/cached-holdings";
import { HOLDINGS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured", rows: [] }, 503);
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
      return jsonCached({ month: null, rows: [] }, HOLDINGS_CACHE_CONTROL);
    }
    const rows = await getSectorRows(picked.month);
    return jsonCached({ month: picked.month, rows }, HOLDINGS_CACHE_CONTROL);
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "sectors_failed" }, 500);
  }
}

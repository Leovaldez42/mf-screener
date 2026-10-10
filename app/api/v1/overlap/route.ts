import { NextRequest } from "next/server";
import { getOverlap, getOverlapSuggestions, parseOverlapFunds } from "@/lib/cached-overlap";
import { HOLDINGS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured" }, 503);
  }
  const funds = parseOverlapFunds(req.nextUrl.searchParams.get("funds"));
  const month = req.nextUrl.searchParams.get("month") || "";
  const suggest = req.nextUrl.searchParams.get("suggest") === "1" || funds.length === 0;

  try {
    if (suggest && funds.length === 0) {
      const suggestions = await getOverlapSuggestions();
      return jsonCached({ suggestions }, HOLDINGS_CACHE_CONTROL);
    }
    const payload = await getOverlap(funds, month);
    if ("error" in payload && payload.error === "need_two_funds") {
      return jsonCached(payload, HOLDINGS_CACHE_CONTROL, 400);
    }
    if ("error" in payload && payload.error === "too_many_funds") {
      return jsonCached(payload, HOLDINGS_CACHE_CONTROL, 400);
    }
    if ("error" in payload && payload.error === "unknown_codes") {
      return jsonCached(payload, HOLDINGS_CACHE_CONTROL, 400);
    }
    if ("error" in payload && payload.error === "unknown_month") {
      return jsonCached(
        { error: payload.error, availableMonths: payload.availableMonths },
        HOLDINGS_CACHE_CONTROL,
        404,
      );
    }
    return jsonCached(payload, HOLDINGS_CACHE_CONTROL);
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "overlap_failed" }, 500);
  }
}

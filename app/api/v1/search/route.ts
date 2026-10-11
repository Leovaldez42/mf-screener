import { NextRequest } from "next/server";
import { HOLDINGS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { searchCatalog } from "@/lib/search";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore(
      { error: "supabase_not_configured", funds: [], stocks: [], suggestions: [], lead: "funds", fundTotal: 0, stockTotal: 0 },
      503,
    );
  }
  const q = req.nextUrl.searchParams.get("q") || "";
  try {
    const t0 = Date.now();
    const result = await searchCatalog(q);
    return jsonCached(
      { ...result, ms: Date.now() - t0 },
      HOLDINGS_CACHE_CONTROL,
    );
  } catch (e) {
    return jsonNoStore(
      { error: e instanceof Error ? e.message : "search_failed", funds: [], stocks: [], suggestions: [], lead: "funds", fundTotal: 0, stockTotal: 0 },
      500,
    );
  }
}

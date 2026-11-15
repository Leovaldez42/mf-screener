import { NextRequest } from "next/server";
import { SNAPSHOT_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { searchCatalogFrom } from "@/lib/search";
import { getSearchIndex } from "@/lib/search-index";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 2592000;

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
    const index = await getSearchIndex();
    const result = searchCatalogFrom(index, q);
    return jsonCached({ ...result, ms: Date.now() - t0 }, SNAPSHOT_CACHE_CONTROL);
  } catch (e) {
    return jsonNoStore(
      { error: e instanceof Error ? e.message : "search_failed", funds: [], stocks: [], suggestions: [], lead: "funds", fundTotal: 0, stockTotal: 0 },
      500,
    );
  }
}

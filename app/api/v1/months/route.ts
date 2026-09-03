import { listCompleteMonths } from "@/lib/holdings-month";
import { HOLDINGS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 300;

export async function GET() {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured", months: [] }, 503);
  }
  try {
    const months = await listCompleteMonths();
    return jsonCached({ months }, HOLDINGS_CACHE_CONTROL);
  } catch (e) {
    const message = e instanceof Error ? e.message : "months_failed";
    return jsonNoStore({ error: message }, 500);
  }
}

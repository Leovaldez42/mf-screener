import { NextRequest } from "next/server";
import { METRICS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { COMPARE_MAX } from "@/lib/scheme-metrics";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const revalidate = 120;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured" }, 503);
  }
  const codes = (req.nextUrl.searchParams.get("codes") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, COMPARE_MAX);
  if (codes.length < 2) {
    return jsonNoStore({ error: "need_two_codes" }, 400);
  }
  const db = createAnonClient();
  const { data, error } = await db.from("scheme_metrics").select("*").in("scheme_code", codes);
  if (error) return jsonNoStore({ error: error.message }, 500);
  const byCode = new Map((data || []).map((r) => [r.scheme_code as string, r]));
  const schemes = codes.map((c) => byCode.get(c)).filter(Boolean);
  return jsonCached({ schemes }, METRICS_CACHE_CONTROL);
}

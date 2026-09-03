import { NextRequest } from "next/server";
import { getSchemePage } from "@/lib/cached-metrics";
import { METRICS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 120;

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured" }, 503);
  }
  const { code } = await params;
  try {
    const payload = await getSchemePage(code);
    if ("error" in payload && payload.error === "not_found") {
      return jsonCached(payload, METRICS_CACHE_CONTROL, 404);
    }
    return jsonCached(payload, METRICS_CACHE_CONTROL);
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "scheme_failed" }, 500);
  }
}

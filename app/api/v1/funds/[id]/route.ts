import { NextRequest } from "next/server";
import { getFundPayload } from "@/lib/cached-holdings";
import { HOLDINGS_CACHE_CONTROL, jsonCached, jsonNoStore } from "@/lib/http-cache";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured" }, 503);
  }
  const { id } = await params;
  const familyId = Number(id);
  if (!Number.isFinite(familyId)) {
    return jsonNoStore({ error: "invalid_id" }, 400);
  }
  const month = req.nextUrl.searchParams.get("month") || "";
  try {
    const payload = await getFundPayload(familyId, month);
    if ("error" in payload && payload.error === "no_holdings") {
      return jsonCached(payload, HOLDINGS_CACHE_CONTROL, 404);
    }
    return jsonCached(payload, HOLDINGS_CACHE_CONTROL);
  } catch (e) {
    return jsonNoStore({ error: e instanceof Error ? e.message : "fund_failed" }, 500);
  }
}

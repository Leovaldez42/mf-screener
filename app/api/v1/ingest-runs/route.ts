import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/http-cache";
import { revalidateAuthorized } from "@/lib/revalidate-auth";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!process.env.REVALIDATE_SECRET) {
    return jsonNoStore({ error: "revalidate_not_configured", runs: [] }, 503);
  }
  if (!revalidateAuthorized(req)) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }
  if (!supabaseConfigured()) {
    return jsonNoStore({ error: "supabase_not_configured", runs: [] }, 503);
  }
  const db = createAnonClient();
  const { data, error } = await db
    .from("ingest_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) return jsonNoStore({ error: error.message }, 500);
  return jsonNoStore({ runs: data || [] });
}

import { jsonNoStore } from "@/lib/http-cache";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
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

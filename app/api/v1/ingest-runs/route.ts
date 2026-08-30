import { NextResponse } from "next/server";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured", runs: [] }, { status: 503 });
  }
  const db = createAnonClient();
  const { data, error } = await db
    .from("ingest_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data || [] });
}

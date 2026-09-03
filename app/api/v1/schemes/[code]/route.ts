import { NextResponse } from "next/server";
import { equalWeightCategoryAverages, type SchemeMetric } from "@/lib/scheme-metrics";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const { code } = await params;
  const db = createAnonClient();
  const { data, error } = await db.from("scheme_metrics").select("*").eq("scheme_code", code).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const category = String((data as SchemeMetric).category || "");
  let categoryAverage = null;
  if (category) {
    const { data: peers, error: peerErr } = await db
      .from("scheme_metrics")
      .select("*")
      .eq("is_direct", true)
      .eq("is_growth", true)
      .eq("is_active_equity", true)
      .eq("category", category)
      .limit(2000);
    if (peerErr) return NextResponse.json({ error: peerErr.message }, { status: 500 });
    categoryAverage = equalWeightCategoryAverages((peers || []) as SchemeMetric[])[category] || null;
  }

  return NextResponse.json({ scheme: data, categoryAverage });
}

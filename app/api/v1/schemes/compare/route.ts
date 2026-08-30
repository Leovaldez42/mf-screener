import { NextRequest, NextResponse } from "next/server";
import { COMPARE_MAX } from "@/lib/scheme-metrics";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const codes = (req.nextUrl.searchParams.get("codes") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, COMPARE_MAX);
  if (codes.length < 2) {
    return NextResponse.json({ error: "need_two_codes" }, { status: 400 });
  }
  const db = createAnonClient();
  const { data, error } = await db.from("scheme_metrics").select("*").in("scheme_code", codes);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byCode = new Map((data || []).map((r) => [r.scheme_code as string, r]));
  const schemes = codes.map((c) => byCode.get(c)).filter(Boolean);
  return NextResponse.json({ schemes });
}

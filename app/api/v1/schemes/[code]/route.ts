import { NextResponse } from "next/server";
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
  return NextResponse.json({ scheme: data });
}

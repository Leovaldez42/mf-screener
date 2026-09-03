import { NextResponse } from "next/server";
import { listCompleteMonths } from "@/lib/holdings-month";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured", months: [] }, { status: 503 });
  }
  try {
    const months = await listCompleteMonths(createAnonClient());
    return NextResponse.json(
      { months },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "months_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

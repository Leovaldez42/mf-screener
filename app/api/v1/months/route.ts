import { NextResponse } from "next/server";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function distinctMonths(table: "stock_month_aggregates" | "holdings_snapshots"): Promise<string[]> {
  const db = createAnonClient();
  const found = new Set<string>();
  const page = 1000;
  for (let from = 0; from < 50000; from += page) {
    const { data, error } = await db.from(table).select("month").order("month", { ascending: false }).range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      if (row.month) found.add(row.month as string);
    }
    if (data.length < page) break;
  }
  return [...found];
}

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured", months: [] }, { status: 503 });
  }
  try {
    const fromAgg = await distinctMonths("stock_month_aggregates");
    const fromSnaps = await distinctMonths("holdings_snapshots");
    const months = [...new Set([...fromAgg, ...fromSnaps])].sort((a, b) => b.localeCompare(a));
    return NextResponse.json(
      { months },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "months_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

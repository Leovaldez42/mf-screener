import { Suspense } from "react";
import { getFundDirectory } from "@/lib/directory";
import { getOverlapSuggestions } from "@/lib/cached-overlap";
import { pageMetadata } from "@/lib/page-meta";
import { supabaseConfigured } from "@/lib/supabase";
import { FundsHub } from "./funds-hub";

export const revalidate = 86400;

export const metadata = pageMetadata({
  title: "Mutual fund screener · Thinkbrew",
  description:
    "Screen Indian Direct Growth mutual funds by category, fund house, returns, and expense ratio. Not investment advice.",
  path: "/funds",
});

export default async function FundsHubPage() {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const [funds, suggestions] = await Promise.all([getFundDirectory(), getOverlapSuggestions()]);
  const houseCount = new Set(funds.map((f) => f.house)).size;
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading funds…</p>}>
      <FundsHub
        tab="screener"
        fundCount={funds.length}
        houseCount={houseCount}
        funds={funds}
        overlap={{ data: null, error: null, suggestions }}
      />
    </Suspense>
  );
}

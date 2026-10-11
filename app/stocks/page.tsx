import type { Metadata } from "next";
import { getStockDirectory } from "@/lib/directory";
import { pageMetadata } from "@/lib/page-meta";
import { supabaseConfigured } from "@/lib/supabase";
import { StocksIndex } from "./stocks-index";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Stocks held by Indian mutual funds · Thinkbrew",
  description:
    "A–Z list of stocks held by Indian active-equity mutual funds, with fund count and sector. Not investment advice.",
  path: "/stocks",
});

export default async function StocksIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const { month, stocks } = await getStockDirectory();
  const initialQ = ((await searchParams).q || "").trim();
  return <StocksIndex stocks={stocks} month={month} initialQ={initialQ} />;
}

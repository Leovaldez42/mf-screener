import type { Metadata } from "next";
import { getStockDirectory } from "@/lib/directory";
import { pageMetadata } from "@/lib/page-meta";
import { supabaseConfigured } from "@/lib/supabase";
import { StocksIndex } from "./stocks-index";

export const revalidate = 86400;

export const metadata: Metadata = pageMetadata({
  title: "Stocks held by Indian mutual funds · Thinkbrew",
  description:
    "A–Z list of stocks held by Indian active-equity mutual funds, with fund count and sector. Not investment advice.",
  path: "/stocks",
});

export default async function StocksIndexPage() {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const dir = await getStockDirectory();
  return <StocksIndex stocks={dir.stocks} month={dir.month} initialQ="" />;
}

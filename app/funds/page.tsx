import type { Metadata } from "next";
import { getFundDirectory } from "@/lib/directory";
import { pageMetadata } from "@/lib/page-meta";
import { supabaseConfigured } from "@/lib/supabase";
import { FundsIndex } from "./funds-index";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "All mutual funds · Thinkbrew",
  description:
    "Browse Indian active-equity mutual fund families by house, category, and AUM. Holdings books, adds and cuts. Not investment advice.",
  path: "/funds",
});

export default async function FundsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const funds = await getFundDirectory();
  const initialQ = ((await searchParams).q || "").trim();
  return <FundsIndex funds={funds} initialQ={initialQ} />;
}

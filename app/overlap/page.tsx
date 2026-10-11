import type { Metadata } from "next";
import { Suspense } from "react";
import { OverlapView } from "./overlap-view";
import { loadOverlapPage, overlapFundNames, parseOverlapFunds } from "@/lib/cached-overlap";
import { pageMetadata } from "@/lib/page-meta";
import { siteUrl } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ funds?: string; month?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const fallback = pageMetadata({
    title: "Fund overlap · Thinkbrew",
    description:
      "See how much the equity books of Indian active funds overlap. Shared stocks, unique names, and sector overlap. Not investment advice.",
    path: "/overlap",
  });
  const funds = parseOverlapFunds(sp.funds || "");
  if (funds.length < 2 || !supabaseConfigured()) return fallback;
  try {
    const names = await overlapFundNames(funds);
    if (names.length < 2) return fallback;
    const a = names[0];
    const b = names[1];
    const vs = names.length === 3 ? `${a} vs ${b} vs ${names[2]}` : `${a} vs ${b}`;
    const title = `${vs} overlap · Thinkbrew`;
    const description = `Stock-level overlap between ${vs}. Shared holdings, unique names, and sector overlap from the latest mutual fund books. Not investment advice.`;
    const path = `/overlap?funds=${funds.join(",")}`;
    return {
      ...pageMetadata({ title, description, path }),
      alternates: { canonical: siteUrl(path) },
    };
  } catch {
    return fallback;
  }
}

export default async function OverlapPage({ searchParams }: Props) {
  const sp = await searchParams;
  const funds = parseOverlapFunds(sp.funds || "");
  const month = sp.month || "";
  let initial = { data: null as Awaited<ReturnType<typeof loadOverlapPage>>["data"], error: null as string | null, suggestions: [] as Awaited<ReturnType<typeof loadOverlapPage>>["suggestions"] };
  if (supabaseConfigured()) {
    try {
      initial = await loadOverlapPage(funds, month);
    } catch (e) {
      initial = { data: null, error: e instanceof Error ? e.message : "Could not load overlap", suggestions: [] };
    }
  }
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <h1 className="text-xl font-medium">Fund overlap</h1>
          <p className="text-sm text-muted">Search and add two or three Direct Growth schemes.</p>
        </div>
      }
    >
      <OverlapView
        initialData={initial.data}
        initialError={initial.error}
        initialSuggestions={initial.suggestions}
      />
    </Suspense>
  );
}

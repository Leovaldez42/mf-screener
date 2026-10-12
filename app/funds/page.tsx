import { Suspense } from "react";
import { loadOverlapPage, overlapFundNames, parseOverlapFunds } from "@/lib/cached-overlap";
import { getFundDirectory } from "@/lib/directory";
import {
  fundsHubDescription,
  fundsHubPath,
  fundsHubTitle,
  parseFundsTab,
} from "@/lib/funds-hub";
import { pageMetadata } from "@/lib/page-meta";
import { siteUrl } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";
import { FundsHub } from "./funds-hub";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = parseFundsTab(sp.tab);
  const fundsParam = first(sp.funds) || first(sp.codes);
  let overlapNames: string[] | undefined;
  if (tab === "overlap" && supabaseConfigured()) {
    const funds = parseOverlapFunds(fundsParam);
    if (funds.length >= 2) {
      try {
        overlapNames = await overlapFundNames(funds);
      } catch {
        overlapNames = undefined;
      }
    }
  }
  const params = new URLSearchParams();
  if (tab === "overlap" && fundsParam) params.set("funds", parseOverlapFunds(fundsParam).join(","));
  else if (tab === "compare" && fundsParam) params.set("funds", fundsParam);
  else if (tab === "all" && first(sp.q)) params.set("q", first(sp.q));
  const path = fundsHubPath(tab, params);
  return {
    ...pageMetadata({
      title: fundsHubTitle(tab, overlapNames),
      description: fundsHubDescription(tab, overlapNames),
      path,
    }),
    alternates: { canonical: siteUrl(path) },
  };
}

export default async function FundsHubPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = parseFundsTab(sp.tab);
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }

  const directory = await getFundDirectory();
  const houseCount = new Set(directory.map((f) => f.house)).size;
  const fundsCsv = first(sp.funds) || first(sp.codes);
  const month = first(sp.month);
  let overlap = {
    data: null as Awaited<ReturnType<typeof loadOverlapPage>>["data"],
    error: null as string | null,
    suggestions: [] as Awaited<ReturnType<typeof loadOverlapPage>>["suggestions"],
  };
  if (tab === "overlap") {
    try {
      overlap = await loadOverlapPage(parseOverlapFunds(fundsCsv), month);
    } catch (e) {
      overlap = {
        data: null,
        error: e instanceof Error ? e.message : "Could not load overlap",
        suggestions: [],
      };
    }
  }

  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading funds…</p>}>
      <FundsHub tab={tab} fundCount={directory.length} houseCount={houseCount} funds={directory} overlap={overlap} />
    </Suspense>
  );
}

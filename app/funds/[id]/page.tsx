import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFundPayload } from "@/lib/cached-holdings";
import { fundPageDescription, fundPageTitle } from "@/lib/page-meta";
import { siteUrl } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";
import { FundView, type FundViewPayload } from "./fund-view";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
};

function asViewPayload(payload: Awaited<ReturnType<typeof getFundPayload>>): FundViewPayload {
  return payload as FundViewPayload;
}

async function loadFund(id: string, month: string) {
  const familyId = Number(id);
  if (!Number.isFinite(familyId)) return null;
  let payload = await getFundPayload(familyId, month);
  if ("error" in payload && payload.error === "not_found") return null;
  if ("error" in payload && payload.error === "unknown_month") {
    payload = await getFundPayload(familyId, "");
  }
  return payload;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { month: q } = await searchParams;
  if (!supabaseConfigured()) return { title: "Fund" };
  const payload = await loadFund(id, q || "");
  if (!payload || ("error" in payload && payload.error === "not_found")) {
    return { title: "Fund not found" };
  }
  const family = "family" in payload ? payload.family : undefined;
  const name = String(family?.name || "Fund");
  const month = "month" in payload ? payload.month : null;
  const holdings = "holdings" in payload ? payload.holdings || [] : [];
  const title = fundPageTitle(name, month);
  const description = fundPageDescription({
    category: family?.sebi_category,
    aumCr: "aum_cr" in payload ? payload.aum_cr : null,
    holdingsCount: holdings.length,
    topNames: holdings.slice(0, 3).map((h) => h.display_name),
  });
  const url = siteUrl(`/funds/${id}${month ? `?month=${month}` : ""}`);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "Thinkbrew",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function FundRoute({ params, searchParams }: Props) {
  const { id } = await params;
  const { month: q } = await searchParams;
  if (!Number.isFinite(Number(id))) notFound();
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const payload = await loadFund(id, q || "");
  if (!payload || ("error" in payload && payload.error === "not_found")) notFound();
  return (
    <FundView
      key={`${id}:${"month" in payload ? payload.month : ""}`}
      initial={asViewPayload(payload)}
      fundId={id}
      requestedMonth={q || ""}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFundPayload } from "@/lib/cached-holdings";
import { fundPageDescription, fundPageTitle } from "@/lib/page-meta";
import { siteUrl } from "@/lib/site";
import { getSiteMeta } from "@/lib/snapshot-read";
import { supabaseConfigured } from "@/lib/supabase";
import { FundView, type FundViewPayload } from "./fund-view";

export const revalidate = 86400;
export const dynamicParams = true;

type Props = { params: Promise<{ id: string }> };

function asViewPayload(payload: Awaited<ReturnType<typeof getFundPayload>>): FundViewPayload {
  return payload as FundViewPayload;
}

async function loadFund(id: string) {
  const familyId = Number(id);
  if (!Number.isFinite(familyId)) return null;
  const payload = await getFundPayload(familyId, "");
  if ("error" in payload && payload.error) return null;
  return payload;
}

export async function generateStaticParams() {
  if (!supabaseConfigured()) return [];
  try {
    const meta = await getSiteMeta();
    return (meta?.topFundIds || []).map((id) => ({ id: String(id) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!supabaseConfigured()) return { title: "Fund" };
  const payload = await loadFund(id);
  if (!payload || ("error" in payload && payload.error)) {
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
  const url = siteUrl(`/funds/${id}`);
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

export default async function FundRoute({ params }: Props) {
  const { id } = await params;
  if (!Number.isFinite(Number(id))) notFound();
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const payload = await loadFund(id);
  if (!payload || ("error" in payload && payload.error)) notFound();
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading fund…</p>}>
      <FundView key={id} initial={asViewPayload(payload)} fundId={id} requestedMonth="" />
    </Suspense>
  );
}

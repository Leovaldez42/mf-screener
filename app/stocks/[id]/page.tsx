import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StockView } from "./stock-view";
import { getStockPayload } from "@/lib/cached-holdings";
import { formatMonthLabel } from "@/lib/format";
import { formatSignedCr } from "@/lib/share-text";
import { ogStockPath, siteUrl } from "@/lib/site";
import { getSiteMeta } from "@/lib/snapshot-read";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 86400;
export const dynamicParams = true;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  if (!supabaseConfigured()) return [];
  try {
    const meta = await getSiteMeta();
    return (meta?.topStockIds || []).map((id) => ({ id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const payload = await getStockPayload(id, "");
  if ("error" in payload && payload.error === "not_found") {
    notFound();
  }
  const name = String(payload.stock?.display_name || "Stock");
  const month = payload.month || "";
  const summary = payload.summary as
    | { fund_count: number; net_value_delta_cr: number }
    | null
    | undefined;
  const monthLabel = formatMonthLabel(month);
  const title = month ? `${name} · ${monthLabel}` : name;
  const description = summary
    ? `${summary.fund_count} active-equity funds · ${formatSignedCr(summary.net_value_delta_cr, 1)} net · quantity-based adds & cuts. Not investment advice.`
    : `Active-equity fund adds and cuts for ${name}. Not investment advice.`;
  const url = siteUrl(`/stocks/${id}`);
  const image = siteUrl(ogStockPath(id, month));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "Thinkbrew",
      images: [{ url: image, width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function StockRoute({ params }: Props) {
  const { id } = await params;
  const payload = await getStockPayload(id, "");
  if ("error" in payload && payload.error === "not_found") notFound();
  return <StockView initial={payload as Parameters<typeof StockView>[0]["initial"]} />;
}

import type { Metadata } from "next";
import { StockView } from "./stock-view";
import { getStockPayload } from "@/lib/cached-holdings";
import { formatMonthLabel } from "@/lib/format";
import { formatSignedCr } from "@/lib/share-text";
import { ogStockPath, siteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { month: q } = await searchParams;
  const payload = await getStockPayload(id, q || "");
  if ("error" in payload && payload.error === "not_found") {
    return { title: "Stock not found" };
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
  const url = siteUrl(`/stocks/${id}${month ? `?month=${month}` : ""}`);
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
      siteName: "MF Chase",
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

export default function StockRoute() {
  return <StockView />;
}

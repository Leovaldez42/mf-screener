import type { Metadata } from "next";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/site";

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const title = opts.title;
  const url = siteUrl(opts.path);
  return {
    title: { absolute: title },
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url,
      title,
      description: opts.description,
      siteName: "Thinkbrew",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: opts.description,
    },
  };
}

export function fundPageTitle(name: string, month: string | null | undefined) {
  const monthBit = month ? ` · ${formatMonthLabel(month)}` : "";
  return `${name} portfolio, holdings & changes${monthBit} · Thinkbrew`;
}

export function fundPageDescription(opts: {
  category: string | null | undefined;
  aumCr: number | null | undefined;
  holdingsCount: number;
  topNames: string[];
}) {
  const category = (opts.category || "").trim() || "Active equity";
  const aum =
    opts.aumCr != null && Number.isFinite(opts.aumCr)
      ? `AUM ₹${formatNumber(opts.aumCr, 0)} cr`
      : null;
  const count = `${opts.holdingsCount} holding${opts.holdingsCount === 1 ? "" : "s"}`;
  const top = opts.topNames.filter(Boolean).slice(0, 3);
  const topLine = top.length ? `Top holdings: ${top.join(", ")}.` : "";
  return [`${category}${aum ? ` · ${aum}` : ""} · ${count}.`, topLine, "Not investment advice."]
    .filter(Boolean)
    .join(" ");
}

export function monthLastModified(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 18, 30, 0));
}

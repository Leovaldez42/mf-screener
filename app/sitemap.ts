import type { MetadataRoute } from "next";
import { getFundDirectory, getStockDirectory } from "@/lib/directory";
import { listCompleteMonths } from "@/lib/holdings-month";
import { monthLastModified } from "@/lib/page-meta";
import { SITE_URL } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAIN_PATHS = [
  "/",
  "/adds-cuts",
  "/funds?tab=compare",
  "/funds?tab=overlap",
  "/funds?tab=all",
  "/sectors",
  "/about",
  "/data",
  "/how-we-calculate",
  "/data-sources",
  "/disclaimer",
  "/reports",
  "/funds",
  "/stocks",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!supabaseConfigured()) {
    return MAIN_PATHS.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
  }
  try {
    const months = await listCompleteMonths();
    const latest = months[0] ?? null;
    const lastModified = latest ? monthLastModified(latest) : undefined;
    const [funds, stockDir] = await Promise.all([getFundDirectory(), getStockDirectory()]);
    const urls = [
      ...MAIN_PATHS.map((path) => `${SITE_URL}${path === "/" ? "" : path}`),
      ...months.map((m) => `${SITE_URL}/reports/${m}`),
      ...months.map((m) => `${SITE_URL}/month/${m}`),
      ...funds.map((f) => `${SITE_URL}/funds/${f.id}`),
      ...stockDir.stocks.map((s) => `${SITE_URL}/stocks/${s.id}`),
    ];
    return urls.map((url) => ({ url, lastModified }));
  } catch (err) {
    console.error("sitemap failed", err);
    return MAIN_PATHS.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
  }
}

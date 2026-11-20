import type { MetadataRoute } from "next";
import { getFundDirectory, getStockDirectory } from "@/lib/directory";
import { listCompleteMonths } from "@/lib/holdings-month";
import { monthLastModified } from "@/lib/page-meta";
import { SITE_URL } from "@/lib/site";
import { getSiteMeta } from "@/lib/snapshot-read";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 2592000;

const MAIN_PATHS = [
  "/",
  "/adds-cuts",
  "/about",
  "/data",
  "/how-we-calculate",
  "/data-sources",
  "/disclaimer",
  "/support",
  "/reports",
  "/funds",
  "/stocks",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!supabaseConfigured()) {
    return MAIN_PATHS.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
  }
  try {
    const meta = await getSiteMeta();
    const months = meta?.months?.length ? meta.months : await listCompleteMonths();
    const funds = meta?.fundDirectory?.length ? meta.fundDirectory : await getFundDirectory();
    const stockDir = meta?.stockDirectory?.stocks?.length ? meta.stockDirectory : await getStockDirectory();
    const latest = months[0] ?? null;
    const lastModified = latest ? monthLastModified(latest) : undefined;
    const urls = [
      ...MAIN_PATHS.map((path) => `${SITE_URL}${path === "/" ? "" : path}`),
      ...months.map((m) => `${SITE_URL}/reports/${m}`),
      ...funds.map((f) => `${SITE_URL}/funds/${f.id}`),
      ...stockDir.stocks.map((s) => `${SITE_URL}/stocks/${s.id}`),
    ];
    return urls.map((url) => ({ url, lastModified }));
  } catch (err) {
    console.error("sitemap failed", err);
    return MAIN_PATHS.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
  }
}

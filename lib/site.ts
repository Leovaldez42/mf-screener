export const SITE_URL = "https://www.thinkbrew.in";
export const OG_TEMPLATE_VERSION = "1";
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
export const OG_CDN_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=86400";

export function siteUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

export function ogStockPath(id: string, month: string) {
  const q = new URLSearchParams();
  if (month) q.set("month", month);
  q.set("v", OG_TEMPLATE_VERSION);
  return `/api/og/stock/${id}?${q}`;
}

export function ogMonthPath(month: string) {
  return `/api/og/month/${month}?v=${OG_TEMPLATE_VERSION}`;
}

export function isYearMonth(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

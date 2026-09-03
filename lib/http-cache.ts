import { NextResponse } from "next/server";

export const HOLDINGS_REVALIDATE_SEC = 300;
export const METRICS_REVALIDATE_SEC = 120;
export const CACHE_TAG_HOLDINGS = "holdings";
export const CACHE_TAG_METRICS = "metrics";

/** Browser always revalidates; CDN / shared caches keep the body. */
export const HOLDINGS_CACHE_CONTROL = `public, max-age=0, s-maxage=${HOLDINGS_REVALIDATE_SEC}, stale-while-revalidate=3600`;
export const METRICS_CACHE_CONTROL = `public, max-age=0, s-maxage=${METRICS_REVALIDATE_SEC}, stale-while-revalidate=1800`;
export const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

export function jsonCached(data: unknown, cacheControl: string, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

export function jsonNoStore(data: unknown, status = 200) {
  return jsonCached(data, NO_STORE_CACHE_CONTROL, status);
}

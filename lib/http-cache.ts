import { NextResponse } from "next/server";

/**
 * Holdings change once a month. `npm run refresh` calls revalidateTag("holdings") after new books and
 * snapshots land, so the time-based expiry is only a backstop. Page `revalidate` exports must repeat
 * this as a literal (2592000).
 */
export const HOLDINGS_REVALIDATE_SEC = 2592000;
export const PAGE_REVALIDATE_SEC = 2592000;
/** CDN headers are not purged by revalidateTag, so they stay at a day. */
const CDN_HOLDINGS_MAX_AGE_SEC = 86400;
export const SNAPSHOT_CACHE_CONTROL =
  `public, s-maxage=${CDN_HOLDINGS_MAX_AGE_SEC}, stale-while-revalidate=604800`;
export const METRICS_REVALIDATE_SEC = 120;
export const CACHE_TAG_HOLDINGS = "holdings";
export const CACHE_TAG_METRICS = "metrics";

/** Browser and CDN both keep holdings JSON so repeat visits skip the network. */
export const HOLDINGS_CACHE_CONTROL = `public, max-age=120, s-maxage=${CDN_HOLDINGS_MAX_AGE_SEC}, stale-while-revalidate=3600`;
/** Closed holdings months do not change; keep the JSON at the CDN for a long time. */
export const REPORT_ARCHIVE_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000";
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

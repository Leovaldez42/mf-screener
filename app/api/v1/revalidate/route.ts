import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS, jsonCached, jsonNoStore } from "@/lib/http-cache";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest, body: { secret?: string }) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  return bearer === secret || body.secret === secret;
}

export async function POST(req: NextRequest) {
  if (!process.env.REVALIDATE_SECRET) {
    return jsonNoStore({ error: "revalidate_not_configured" }, 503);
  }
  const body = (await req.json().catch(() => ({}))) as { secret?: string; tags?: string };
  if (!authorized(req, body)) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const requested = body.tags;
  const tags =
    requested === "holdings"
      ? [CACHE_TAG_HOLDINGS]
      : requested === "metrics"
        ? [CACHE_TAG_METRICS]
        : [CACHE_TAG_HOLDINGS, CACHE_TAG_METRICS];

  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return jsonCached({ revalidated: tags }, "no-store, max-age=0");
}

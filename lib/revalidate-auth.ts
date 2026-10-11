import { NextRequest } from "next/server";

export function revalidateAuthorized(req: NextRequest, body: { secret?: string } = {}) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  return bearer === secret || body.secret === secret;
}

/** Called from ingest scripts. No-op unless the Next app is reachable and REVALIDATE_SECRET is set. */
export async function notifyRevalidate(tags: "holdings" | "metrics" | "all") {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return;
  try {
    const res = await fetch(`${base}/api/v1/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) {
      console.warn(`revalidate ${tags} failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.warn(`revalidate ${tags} skipped: ${e instanceof Error ? e.message : e}`);
  }
}

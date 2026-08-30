/** Probe FinAPI holdings-history endpoint. Does not print the API key. */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 1) continue;
        const key = t.slice(0, eq).trim();
        const value = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      /* missing */
    }
  }
}

loadEnv();

const KEY = process.env.FINAPI_API_KEY!;
const BASE = "https://finapi.upvaly.com";

async function hit(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-Key": KEY, Accept: "application/json" },
  });
  const text = await res.text();
  let summary = text.slice(0, 200).replace(/\s+/g, " ");
  try {
    const j = JSON.parse(text);
    const d = j.data;
    if (Array.isArray(d)) {
      const months = [
        ...new Set(
          d.map((x: { month?: string; asOf?: string; holdingsAsOf?: string; period?: string }) =>
            x.month || x.asOf || x.holdingsAsOf || x.period || Object.keys(x)[0]
          )
        ),
      ];
      const first = d[0];
      summary = `array len=${d.length} firstKeys=${first ? Object.keys(first).join(",") : "-"} monthsSample=${months.slice(0, 8).join("|")}`;
      if (first?.holdings && Array.isArray(first.holdings) && first.holdings[0]) {
        summary += ` holding0keys=${Object.keys(first.holdings[0]).join(",")}`;
      }
    } else if (d && typeof d === "object") {
      summary = `object keys=${Object.keys(d).join(",")}`;
      const inner = (d as { holdings?: unknown; history?: unknown }).history || (d as { months?: unknown }).months;
      if (Array.isArray(inner)) summary += ` nestedArray=${inner.length}`;
    } else {
      summary = `status=${j.status} msg=${j.message || j.error || ""}`;
    }
  } catch {
    /* keep text snippet */
  }
  console.log(`${res.status} ${path}`);
  console.log(`  ${summary}`);
}

async function inspect() {
  const path =
    "/api/mf/holdings-history/scheme-code/122639?startMonth=05-2026&endMonth=07-2026";
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-Key": KEY, Accept: "application/json" },
  });
  const j = await res.json();
  const d = j.data;
  console.log("HTTP", res.status);
  if (!d) {
    console.log(j);
    return;
  }
  const hh = d.holdingsHistory;
  console.log("holdingsHistory type", Array.isArray(hh) ? `array ${hh.length}` : typeof hh);
  if (Array.isArray(hh) && hh[0]) {
    console.log("entry keys", Object.keys(hh[0]));
    console.log("asOf/month fields", {
      holdingsAsOf: hh[0].holdingsAsOf,
      month: hh[0].month,
      asOf: hh[0].asOf,
      date: hh[0].date,
    });
    const h = hh[0].holdings || hh[0].portfolio;
    if (Array.isArray(h)) {
      console.log("inner holdings", h.length, "keys", Object.keys(h[0] || {}));
      console.log("sample", {
        name: h[0]?.name,
        isin: h[0]?.isin,
        qty: h[0]?.quantity,
        w: h[0]?.weightage,
      });
    } else {
      console.log("entry sample keys/values types", Object.fromEntries(Object.entries(hh[0]).map(([k, v]) => [k, Array.isArray(v) ? `arr ${v.length}` : typeof v])));
    }
    const asOfs = hh.map((x: Record<string, unknown>) => x.holdingsAsOf || x.month || x.asOf);
    console.log("all period labels", asOfs);
  }
  const sh = d.sectorsHistory;
  console.log("sectorsHistory", Array.isArray(sh) ? `array ${sh.length}` : typeof sh);
}

async function main() {
  await inspect();
}

main();

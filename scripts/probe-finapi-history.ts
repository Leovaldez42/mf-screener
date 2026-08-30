/** Probe possible FinAPI historical-holdings URLs. Does not print the API key. */
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
  const res = await fetch(`${BASE}${path}`, { headers: { "X-API-Key": KEY, Accept: "application/json" } });
  const text = await res.text();
  let keys = "";
  let asOf = "";
  let nHold = "";
  try {
    const j = JSON.parse(text);
    const d = j.data;
    keys = d && typeof d === "object" && !Array.isArray(d) ? Object.keys(d).join(",") : Array.isArray(d) ? `array:${d.length}` : typeof d;
    const h = d?.holdings;
    if (Array.isArray(h)) {
      nHold = String(h.length);
      asOf = [...new Set(h.map((x: { holdingsAsOf?: string }) => x.holdingsAsOf))].join("|");
    }
  } catch {
    keys = text.slice(0, 80).replace(/\s+/g, " ");
  }
  console.log(`${res.status} ${path}`);
  console.log(`  keys=${keys} holdings=${nHold || "-"} asOf=${asOf || "-"}`);
}

async function main() {
  const paths = [
    "/api/mf/scheme-code/122639/holdings",
    "/api/mf/scheme-code/122639/holdings/history",
    "/api/mf/scheme-code/122639/historical-holdings",
    "/api/mf/scheme-code/122639/portfolio/history",
    "/api/mf/isin/INF879O01027/holdings",
    "/api/mf/scheme-code/122639?fields=holdings&month=2026-06",
    "/api/mf/scheme-code/122639?fields=holdings&asOf=2026-06-30",
    "/api/mf/scheme-code/122639?fields=holdings&holdingsAsOf=06-2026",
    "/api/mf/scheme-code/122639?fields=holdings&date=2026-06-30",
    "/api/mf/scheme-code/122639?fields=holdings&asOfDate=2026-05-31",
    "/api/mf/scheme-code/122639?fields=holdingsHistory,holdings",
  ];
  for (const p of paths) await hit(p);
}

main();

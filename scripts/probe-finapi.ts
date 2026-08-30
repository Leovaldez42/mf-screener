/**
 * Inspect FinAPI Pro holdings payload. Do not print the API key.
 *
 *   FINAPI_API_KEY=... npx tsx scripts/probe-finapi.ts
 *   or put the key in .env.local and: npm run probe:finapi
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      /* missing file */
    }
  }
}

loadEnv();

const KEY = process.env.FINAPI_API_KEY;
const BASE = (process.env.FINAPI_BASE || "https://finapi.upvaly.com").replace(/\/$/, "");

function walk(value: unknown, path: string, out: string[], depth: number) {
  if (depth > 6) return;
  if (value == null) {
    out.push(`${path} = null`);
    return;
  }
  if (Array.isArray(value)) {
    out.push(`${path} = array(len=${value.length})`);
    if (value.length) walk(value[0], `${path}[0]`, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    out.push(`${path} = object(keys=${keys.join(",")})`);
    for (const k of keys) {
      walk((value as Record<string, unknown>)[k], `${path}.${k}`, out, depth + 1);
    }
    return;
  }
  const shown = typeof value === "string" && value.length > 80 ? `${value.slice(0, 80)}…` : JSON.stringify(value);
  out.push(`${path} = ${typeof value} ${shown}`);
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "X-API-Key": KEY as string },
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, json };
}

function interesting(blob: unknown): string[] {
  const s = JSON.stringify(blob).toLowerCase();
  const needles = ["isin", "quantity", "qty", "holding", "portfolio", "weight", "month", "history", "shares"];
  return needles.filter((n) => s.includes(n));
}

async function main() {
  if (!KEY || KEY.includes("your_finapi")) {
    console.error("Set FINAPI_API_KEY in .env.local (do not commit it).");
    process.exit(1);
  }

  const urls = [
    "/api/mf/scheme-code/122639?fields=holdings,portfolio,sectors",
    "/api/mf/scheme-code/122639",
    "/api/mf/isin/INF879O01027?fields=holdings,portfolio",
    "/api/mf/compare?funds=122639,125494&fields=portfolio,holdings",
  ];

  for (const path of urls) {
    console.log("\n========", path, "========");
    const { status, json } = await get(path);
    console.log("HTTP", status);
    console.log("mentions:", interesting(json).join(", ") || "(none)");
    const lines: string[] = [];
    walk(json, "$", lines, 0);
    console.log(lines.slice(0, 80).join("\n"));
    if (lines.length > 80) console.log(`… ${lines.length - 80} more paths`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
